import { randomUUID } from "node:crypto";

export function safeGuidedValue(value, depth = 0) {
  if (depth > 7) return "[pominięto dalsze szczegóły]";
  if (typeof value === "string")
    return value
      .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
      .replace(/Bearer\s+\S+/gi, "Bearer [ukryto]")
      .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[token ukryty]")
      .slice(0, 5000);
  if (Array.isArray(value))
    return value.slice(0, 30).map((item) => safeGuidedValue(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 70)
        .map(([key, item]) => [
          key,
          /password|hasło|authorization|cookie|secret|token|email|phone|firstName|lastName|adress|address/i.test(
            key,
          )
            ? "[ukryto]"
            : safeGuidedValue(item, depth + 1),
        ]),
    );
  return value;
}

export function safeInspection(value) {
  if (!value || typeof value !== "object") return null;
  const schools = (Array.isArray(value.schools) ? value.schools : []).slice(0, 15).map(school => {
    const id = String(school.id || "");
    if (!/^\d+$/.test(id)) throw new Error("Niepoprawne ID szkoły w podglądzie.");
    const url = new URL(school.url);
    if (!["https://octopus.gwodev.pl", "https://octopus.gwotest.pl"].includes(url.origin) || url.pathname !== `/school/school-panel/${id}` || url.search || url.hash)
      throw new Error("Niepoprawny link do szkoły w podglądzie.");
    return {
      id, url: url.href,
      node: String(safeGuidedValue(school.node || "")).slice(0, 30),
      name: String(safeGuidedValue(school.name || "")).slice(0, 240),
      role: String(safeGuidedValue(school.role || "")).slice(0, 120),
      orders: (Array.isArray(school.orders) ? school.orders : []).slice(0, 30).map(order => ({
        id: String(order.id).slice(0, 30),
        symbol: String(safeGuidedValue(order.symbol || "")).slice(0, 120),
        copied: order.copied === true,
      })),
    };
  });
  return {
    phase: ["before", "after", "cleanup"].includes(value.phase) ? value.phase : "before",
    message: String(safeGuidedValue(value.message || "")).slice(0, 1500),
    preview: value.preview === true,
    schools,
    ...(value.request ? {request: safeGuidedValue(value.request)} : {}),
  };
}

export class GuidedApiRun {
  constructor(runId, notify = () => {}) {
    this.runId = runId;
    this.key = randomUUID();
    this.notify = notify;
    this.steps = [];
    this.waiters = new Map();
    this.closed = false;
    this.continuous = false;
  }
  snapshot() {
    return {
      runId: this.runId,
      closed: this.closed,
      continuous: this.continuous,
      steps: this.steps.map((step) => ({ ...step, ready: this.waiters.has(step.id) })),
    };
  }
  event(body) {
    if (this.closed) throw new Error("Podgląd API został zakończony.");
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(body.stepId || "")) throw new Error("Niepoprawny krok API.");
    let step = this.steps.find((item) => item.id === body.stepId);
    if (body.kind === "start") {
      if (body.checkpoint === true && body.automatic === true)
        throw new Error("Punkt podglądu nie może być wykonywany automatycznie.");
      if (step || this.steps.some((item) => ["waiting", "running"].includes(item.status)))
        throw new Error("Poprzedni krok jeszcze trwa.");
      const inspection = safeInspection(body.inspection);
      if (body.checkpoint === true) this.continuous = false;
      step = {
        id: body.stepId,
        title: String(safeGuidedValue(body.title)).slice(0, 240),
        automatic: body.automatic === true,
        status: body.automatic ? "running" : "waiting",
        requests: [],
        startedAt: new Date().toISOString(),
        checkpoint: body.checkpoint === true,
        ...(inspection ? { inspection } : {}),
      };
      this.steps.push(step);
    } else {
      if (!step || step.status !== "running") throw new Error("Krok nie jest wykonywany.");
      if (body.kind === "request")
        step.requests = [...step.requests, safeGuidedValue(body.request)].slice(-30);
      else if (body.kind === "finish" && ["passed", "failed"].includes(body.status)) {
        step.status = body.status;
        step.endedAt = new Date().toISOString();
        step.error = body.error ? safeGuidedValue(body.error) : "";
      } else throw new Error("Niepoprawna aktualizacja kroku.");
    }
    this.notify();
  }
  wait(stepId) {
    const step = this.steps.find((item) => item.id === stepId);
    if (
      this.closed ||
      !step ||
      step.automatic ||
      step.status !== "waiting" ||
      this.waiters.has(stepId)
    )
      throw new Error("Nie można oczekiwać na ten krok.");
    return new Promise((resolve) => {
      this.waiters.set(stepId, resolve);
      if (this.continuous) this.next(stepId);
      this.notify();
    });
  }
  setContinuous(value) {
    if (this.closed) throw new Error("Ten przebieg został zakończony.");
    this.continuous = value === true;
    if (this.continuous) {
      for (const id of this.waiters.keys()) this.next(id);
    }
    this.notify();
  }
  next(stepId) {
    const step = this.steps.find((item) => item.id === stepId);
    const resolve = this.waiters.get(stepId);
    if (this.closed || !step || step.status !== "waiting" || !resolve)
      throw new Error("Krok nie jest gotowy lub został już uruchomiony.");
    this.waiters.delete(stepId);
    step.status = "running";
    resolve({ proceed: true });
    this.notify();
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.waiters.values()) resolve({ proceed: false });
    this.waiters.clear();
    for (const step of this.steps)
      if (["waiting", "running"].includes(step.status)) step.status = "interrupted";
    this.notify();
  }
}
