import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { dayKey } from "../format";
import { TOOLS, TOOL_LABELS, ToolError, runTool } from "./tools";

export const ASSISTANT_MODEL = "claude-opus-5-5";
const MAX_STEPS = 12; // model calls per user message
const MAX_TURNS = 40; // user messages per chat before suggesting a new one
const DAILY_LIMIT = Number(process.env.ASSISTANT_DAILY_LIMIT) || 300; // model calls per club per day

export const assistantEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

export type AssistantEvent =
  | { t: "chat"; id: string; title: string }
  | { t: "tool"; id: string; name: string; label: string }
  | { t: "tool_done"; id: string; ok: boolean; link?: string; error?: string }
  | { t: "text"; text: string }
  | { t: "error"; message: string }
  | { t: "done" };

function systemPrompt(clubName: string) {
  return `You are the ChessGo assistant inside the admin panel of "${clubName}", a children's chess academy in Poland. You help the club admin run the club: answer questions about students, groups, attendance, payments and sign-ups; create chess puzzles; draft and create news posts; plan tournaments; write messages for parents.

Language: reply in the language the admin writes in (Polish by default). In Polish prose use Polish piece letters (K, H, W, G, S), but always pass moves to tools in English SAN (K, Q, R, B, N). Amounts are in złoty unless the club data says otherwise.

Data: use the tools to look things up; never invent students, numbers or results. If a tool returns an error, fix the input and try again or explain the problem. Keep personal data (phones, emails) to what the admin asked for.

Chess puzzles: design the position yourself, then verify it with check_chess_position before creating it: the FEN must be legal, every solution move legal, and the line must actually work (e.g. a "mate in 2" must end in checkmate against every reasonable defence; check the main defences). Prefer clean positions suitable for children; give a Polish title, a short hint and a fitting rating (beginners 600–900). When asked for several puzzles, create each one separately. Avoid copying puzzles that already exist (list_puzzles). For reliable ready-made puzzles use find_lichess_puzzles (the open Lichess database, public domain) and then create_puzzle. You cannot copy puzzles from chess.com or other sites: their content is not free to reuse; offer Lichess or your own puzzles instead.

Actions: you can create puzzles, news posts (as drafts unless the admin asked to publish), groups and tournaments, and award bonus XP. Before awarding XP or creating more than 5 items at once, confirm with the admin unless they already gave exact instructions. You cannot delete anything, send emails or take payments: when asked, explain where in the panel the admin can do it (e.g. "Opłaty za zajęcia", "Poczta", "Uczniowie"), or draft the text for them.

Style: be brief and practical. Use short paragraphs, "- " bullet lists and **bold** only; no tables or headings. After creating something, say what was created and where to find it.

Today is ${dayKey()} (Europe/Warsaw).`;
}

type Stored = Anthropic.Beta.BetaMessageParam[];

async function countUsage(clubId: string, usage?: Anthropic.Beta.BetaUsage) {
  const day = dayKey();
  const input = (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
  await db.assistantUsage.upsert({
    where: { clubId_day: { clubId, day } },
    create: { clubId, day, requests: 1, inputTokens: input, outputTokens: usage?.output_tokens ?? 0 },
    update: { requests: { increment: 1 }, inputTokens: { increment: input }, outputTokens: { increment: usage?.output_tokens ?? 0 } },
  });
}

/**
 * One user message → model/tool loop. History is stored append-only in AssistantChat.messages
 * (assistant turns are saved exactly as returned, including thinking blocks).
 */
export async function runAssistant(opts: {
  clubId: string; clubName: string; userId: string; chatId?: string | null; text: string;
  emit: (e: AssistantEvent) => void;
}) {
  const { clubId, userId, emit } = opts;
  let chat = opts.chatId ? await db.assistantChat.findFirst({ where: { id: opts.chatId, clubId, userId } }) : null;
  const messages: Stored = chat ? (chat.messages as unknown as Stored) : [];
  const userTurns = messages.filter((m) => m.role === "user" && typeof m.content === "string").length;
  if (userTurns >= MAX_TURNS) {
    emit({ t: "error", message: "Ta rozmowa jest już bardzo długa — zacznij nową, aby asystent działał szybko." });
    return;
  }
  const usage = await db.assistantUsage.findUnique({ where: { clubId_day: { clubId, day: dayKey() } } });
  if ((usage?.requests ?? 0) >= DAILY_LIMIT) {
    emit({ t: "error", message: "Dzienny limit asystenta został wykorzystany. Spróbuj jutro." });
    return;
  }

  messages.push({ role: "user", content: opts.text });
  if (!chat) {
    chat = await db.assistantChat.create({
      data: { clubId, userId, title: opts.text.replace(/\s+/g, " ").slice(0, 80), messages: messages as unknown as Prisma.InputJsonValue },
    });
  }
  emit({ t: "chat", id: chat.id, title: chat.title });
  const save = () => db.assistantChat.update({ where: { id: chat!.id }, data: { messages: messages as unknown as Prisma.InputJsonValue } });

  const client = new Anthropic();
  const system = systemPrompt(opts.clubName);
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await client.beta.messages.create({
        model: ASSISTANT_MODEL,
        max_tokens: 16000,
        system,
        tools: TOOLS,
        messages,
        cache_control: { type: "ephemeral" },
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      await countUsage(clubId, res.usage);
      messages.push({ role: "assistant", content: res.content as unknown as Anthropic.Beta.BetaContentBlockParam[] });
      await save();

      for (const b of res.content) if (b.type === "text" && b.text.trim()) emit({ t: "text", text: b.text });

      if (res.stop_reason === "refusal") {
        emit({ t: "error", message: "Asystent nie może pomóc w tej sprawie. Spróbuj sformułować prośbę inaczej." });
        break;
      }
      if (res.stop_reason === "pause_turn") continue;
      if (res.stop_reason === "max_tokens") {
        emit({ t: "error", message: "Odpowiedź była za długa i została ucięta. Poproś o krótszą wersję." });
        break;
      }
      if (res.stop_reason !== "tool_use") break;

      const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        emit({ t: "tool", id: call.id, name: call.name, label: TOOL_LABELS[call.name] ?? call.name });
        try {
          const input = call.input && typeof call.input === "object" ? (call.input as Record<string, unknown>) : {};
          const out = await runTool({ clubId, userId }, call.name, input);
          results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out.result) });
          emit({ t: "tool_done", id: call.id, ok: true, link: out.link });
        } catch (e) {
          const msg = e instanceof ToolError ? e.message : "Internal error while running the tool.";
          if (!(e instanceof ToolError)) console.error("[assistant] tool failed", call.name, e);
          results.push({ type: "tool_result", tool_use_id: call.id, content: msg, is_error: true });
          emit({ t: "tool_done", id: call.id, ok: false, error: msg });
        }
      }
      messages.push({ role: "user", content: results });
      await save();
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) emit({ t: "error", message: "Klucz API asystenta jest nieprawidłowy (ANTHROPIC_API_KEY)." });
    else if (e instanceof Anthropic.RateLimitError) emit({ t: "error", message: "Asystent jest chwilowo przeciążony. Spróbuj za minutę." });
    else if (e instanceof Anthropic.APIError) {
      console.error("[assistant] API error", e.status, e.message);
      emit({ t: "error", message: `Błąd usługi AI (${e.status ?? "?"}). Spróbuj ponownie.` });
    } else {
      console.error("[assistant] failed", e);
      emit({ t: "error", message: "Coś poszło nie tak. Spróbuj ponownie." });
    }
  }
  emit({ t: "done" });
}

/** Chat history in a shape the UI can render (user text, assistant text, tool chips). */
export type ViewItem =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "tool"; label: string; ok: boolean; link?: string };

export function toView(stored: Stored): ViewItem[] {
  const out: ViewItem[] = [];
  const errors = new Set<string>();
  for (const m of stored) {
    if (m.role === "user" && Array.isArray(m.content))
      for (const b of m.content) if (b.type === "tool_result" && b.is_error) errors.add(b.tool_use_id);
  }
  for (const m of stored) {
    if (m.role === "user") {
      if (typeof m.content === "string") out.push({ role: "user", text: m.content });
      continue;
    }
    if (!Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b.type === "text" && b.text.trim()) out.push({ role: "assistant", text: b.text });
      if (b.type === "tool_use") out.push({ role: "tool", label: TOOL_LABELS[b.name] ?? b.name, ok: !errors.has(b.id) });
    }
  }
  return out;
}
