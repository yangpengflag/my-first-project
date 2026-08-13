#!/usr/bin/env tsx
/**
 * Repo Wiki Generator
 * 扫描 backend/ 与 frontend/ 子仓业务代码，生成结构化知识库到 docs/wiki/。
 *
 * 用法:
 *   npx tsx scripts/wiki-generator.ts                 # 全量生成
 *   npx tsx scripts/wiki-generator.ts --incremental   # 仅更新有变化的模块
 *   npx tsx scripts/wiki-generator.ts --scope=backend # 仅扫描 backend
 *   npx tsx scripts/wiki-generator.ts --scope=frontend
 *   npx tsx scripts/wiki-generator.ts --out=docs/wiki --help
 *
 * 设计: 脚本只负责"提取结构骨架"，自然语言叙述由 AI (repo-wiki skill) 在校验时补充。
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------- 配置 ----------

const ROOT = process.cwd();
const DEFAULT_OUT = path.join(ROOT, "docs", "wiki");

const SCANNERS: Record<
  string,
  { label: string; root: string; ignore: string[] }
> = {
  backend: {
    label: "backend",
    root: path.join(ROOT, "backend", "src", "main", "java"),
    ignore: ["target", "build", ".git", "test"],
  },
  frontend: {
    label: "frontend",
    root: path.join(ROOT, "frontend", "src"),
    ignore: ["node_modules", "dist", ".git", "test", "__tests__"],
  },
};

interface ModuleDoc {
  id: string; // 文件名友好 id, e.g. backend-todo
  scope: string; // backend | frontend
  title: string; // 模块标题
  sourceDir: string; // 相对 ROOT 的源目录
  files: { rel: string; symbols: string[] }[];
  dependsOn: string[];
}

// ---------- 工具 ----------

function walk(dir: string, ignore: string[]): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ignore));
    else out.push(full);
  }
  return out;
}

function relToRoot(p: string): string {
  return path.relative(ROOT, p).split(path.sep).join("/");
}

function newestMtime(files: string[]): number {
  return files.reduce((m, f) => {
    try {
      return Math.max(m, fs.statSync(f).mtimeMs);
    } catch {
      return m;
    }
  }, 0);
}

// ---------- Backend 扫描 (Java) ----------

function scanBackend(): ModuleDoc[] {
  const cfg = SCANNERS.backend;
  if (!fs.existsSync(cfg.root)) return [];
  const files = walk(cfg.root, cfg.ignore).filter((f) => f.endsWith(".java"));
  // 按顶层业务包分组: com.icool.backend.<feature>.*
  const groups = new Map<string, string[]>();
  for (const f of files) {
    const rel = relToRoot(f);
    // 包路径: backend/src/main/java/com/<group>/backend/<feature>/X.java
    const parts = rel.split("/");
    const javaIdx = parts.indexOf("java");
    // feature = "java" 之后、backend 包之后的第一级子包；无子包则用类名去后缀
    const afterJava = parts.slice(javaIdx + 1);
    const backendPos = afterJava.indexOf("backend");
    // 按业务包分组: backend 包之后若还有子包则用子包名，否则归入 core
    let feature = "core";
    if (backendPos >= 0 && afterJava[backendPos + 1] && !afterJava[backendPos + 1].endsWith(".java")) {
      feature = afterJava[backendPos + 1];
    }
    const key = `backend-${feature}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  const modules: ModuleDoc[] = [];
  for (const [id, fsList] of groups) {
    const feature = id.replace("backend-", "");
    const title = `Backend: ${feature} 模块`;
    const files2 = fsList.map((f) => ({
      rel: relToRoot(f),
      symbols: extractJavaSymbols(fs.readFileSync(f, "utf8")),
    }));
    const sourceDir = relToRoot(path.dirname(fsList[0]));
    modules.push({
      id,
      scope: "backend",
      title,
      sourceDir,
      files: files2,
      dependsOn: inferBackendDeps(files2),
    });
  }
  return modules;
}

function extractJavaSymbols(src: string): string[] {
  const syms: string[] = [];
  const classRe =
    /(?:public\s+)?(?:final\s+)?(class|interface|enum|record)\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(src))) syms.push(`${m[1]} ${m[2]}`);
  const annoRe = /@(\w+)(?:\([^)]*\))?/g;
  let a: RegExpExecArray | null;
  const annos = new Set<string>();
  while ((a = annoRe.exec(src))) annos.add(a[1]);
  for (const an of annos)
    if (["RestController", "Service", "Component", "Controller", "Repository"].includes(an))
      syms.unshift(`@${an}`);
  const methodRe =
    /(?:public|protected)\s+[\w<>\[\],\s]+\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let me: RegExpExecArray | null;
  while ((me = methodRe.exec(src))) {
    if (me[1] === "main") continue;
    syms.push(`${me[1]}(${me[2].split(",").length ? me[2].trim() : ""})`);
  }
  return syms.slice(0, 40);
}

function inferBackendDeps(files: { rel: string; symbols: string[] }[]): string[] {
  const deps = new Set<string>();
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f.rel), "utf8");
    const imp = src.match(/import\s+[\w.]+\.(\w+);/g);
    if (imp)
      for (const i of imp) {
        const cls = i.match(/\.(\w+);$/)?.[1];
        if (cls && !cls.startsWith("Todo") && /Controller|Service|Store|Repository/.test(cls))
          deps.add(cls);
      }
  }
  return [...deps].slice(0, 10);
}

// ---------- Frontend 扫描 (Vue / TS) ----------

function scanFrontend(): ModuleDoc[] {
  const cfg = SCANNERS.frontend;
  if (!fs.existsSync(cfg.root)) return [];
  const files = walk(cfg.root, cfg.ignore).filter(
    (f) => f.endsWith(".vue") || f.endsWith(".ts")
  );
  // 按一级目录分组: views / components / stores / router / api
  const groups = new Map<string, string[]>();
  for (const f of files) {
    const rel = relToRoot(f);
    const parts = rel.split("/");
    // frontend/src/<group>/X  —— 根级散文件 (App.vue/main.ts) 归入 misc
    const srcIdx = parts.indexOf("src");
    const group = parts[srcIdx + 1] && !parts[srcIdx + 1].endsWith(".vue") && !parts[srcIdx + 1].endsWith(".ts")
      ? parts[srcIdx + 1]
      : "misc";
    const key = `frontend-${group}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  const modules: ModuleDoc[] = [];
  for (const [id, fsList] of groups) {
    const title = id.replace("frontend-", "Frontend: ") + " 模块";
    const files2 = fsList.map((f) => ({
      rel: relToRoot(f),
      symbols: extractFrontendSymbols(fs.readFileSync(f, "utf8"), f),
    }));
    modules.push({
      id,
      scope: "frontend",
      title,
      sourceDir: relToRoot(path.dirname(fsList[0])),
      files: files2,
      dependsOn: inferFrontendDeps(files2),
    });
  }
  return modules;
}

function extractFrontendSymbols(src: string, file: string): string[] {
  const syms: string[] = [];
  if (file.endsWith(".vue")) {
    const props = src.match(/defineProps[<(]([^)>]*)[>)]/);
    if (props) syms.push(`props: ${props[1].trim().slice(0, 60)}`);
    const emits = src.match(/defineEmits[<(]([^)>]*)[>)]/);
    if (emits) syms.push(`emits: ${emits[1].trim().slice(0, 60)}`);
    const name = src.match(/export\s+default\s+defineComponent|<script\s+setup[^>]*>/);
    if (name) syms.unshift("Vue SFC");
  } else {
    const exp = src.match(/export\s+(?:function|const|class|interface|type)\s+(\w+)/g);
    if (exp) for (const e of exp) syms.push(e.replace("export ", ""));
  }
  const route = src.match(/path:\s*["'`]([^"'`]+)["'`]/g);
  if (route) for (const r of route) syms.push(r.trim());
  return syms.slice(0, 40);
}

function inferFrontendDeps(files: { rel: string; symbols: string[] }[]): string[] {
  const deps = new Set<string>();
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f.rel), "utf8");
    const imp = src.match(/import\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g);
    if (imp)
      for (const i of imp) {
        const target = i.match(/from\s+['"]([^'"]+)['"]/)?.[1];
        if (target && target.startsWith(".")) {
          const base = target.split("/").pop()?.replace(/\.\w+$/, "");
          if (base) deps.add(base);
        }
      }
  }
  return [...deps].slice(0, 10);
}

// ---------- 渲染 ----------

function renderModule(m: ModuleDoc): string {
  const lines: string[] = [];
  lines.push(`# ${m.title}\n`);
  lines.push(`> 来源目录: \`${m.sourceDir}/\``);
  lines.push(`> 范围: ${m.scope}\n`);
  lines.push(`## 职责`);
  lines.push(`（由 AI 在校验时补充自然语言叙述：该模块负责什么、为什么存在。）\n`);
  lines.push(`## 关键文件`);
  lines.push("");
  lines.push("| 文件 | 主要符号 |");
  lines.push("|------|----------|");
  for (const f of m.files) {
    const syms = f.symbols.join("、") || "—";
    lines.push(`| \`${f.rel}\` | ${syms} |`);
  }
  lines.push("");
  if (m.dependsOn.length) {
    lines.push(`## 依赖`);
    lines.push("");
    for (const d of m.dependsOn) lines.push(`- ${d}`);
    lines.push("");
  }
  return lines.join("\n");
}

function renderArchitecture(modules: ModuleDoc[]): string {
  const be = modules.filter((m) => m.scope === "backend");
  const fe = modules.filter((m) => m.scope === "frontend");
  const lines: string[] = [];
  lines.push("# 架构总览\n");
  lines.push("```");
  lines.push("┌─────────────────────────┐      ┌─────────────────────────┐");
  lines.push("│  Frontend (Vue 3 + TS)  │ ───▶ │  Backend (Spring Boot)  │");
  lines.push("│  " + (fe[0]?.title ?? "—").padEnd(21) + " │      │  " + (be[0]?.title ?? "—").padEnd(21) + " │");
  lines.push("└─────────────────────────┘      └─────────────────────────┘");
  lines.push("```\n");
  lines.push("（脚本仅生成骨架，AI 在校验时补充分层说明与调用关系。）\n");
  lines.push("## 已识别模块");
  lines.push("");
  for (const m of modules) lines.push(`- ${m.title} (\`${m.sourceDir}/\`)`);
  lines.push("");
  return lines.join("\n");
}

function renderIndex(modules: ModuleDoc[], outDir: string): string {
  const now = new Date().toISOString();
  const lines: string[] = [];
  lines.push("# Repo Wiki\n");
  lines.push(`> 自动生成于 ${now}，由 scripts/wiki-generator.ts 产出`);
  lines.push("> 范围：backend/ + frontend/\n");
  lines.push("## 模块索引\n");
  lines.push(`- [架构总览](./architecture.md)`);
  for (const m of modules) {
    const link = `./modules/${m.id}.md`;
    lines.push(`- [${m.title}](${link})`);
  }
  lines.push("");
  lines.push("## 检索说明");
  lines.push("");
  lines.push("AI 问答时：先读本 INDEX，按链接定位到具体模块文档，再做定向读取。");
  lines.push("");
  return lines.join("\n");
}

// ---------- 增量状态 ----------

const STATE_FILE = ".wiki-state.json"; // 记录各模块最新 mtime

function loadState(): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, STATE_FILE), "utf8"));
  } catch {
    return {};
  }
}
function saveState(s: Record<string, number>) {
  fs.writeFileSync(path.join(ROOT, STATE_FILE), JSON.stringify(s, null, 2));
}

// ---------- 主流程 ----------

function main() {
  const args = process.argv.slice(2);
  const help = args.includes("--help") || args.includes("-h");
  if (help) {
    console.log(`Repo Wiki Generator

用法:
  tsx scripts/wiki-generator.ts [--incremental] [--scope=backend|frontend] [--out=<dir>]

选项:
  --incremental   仅重生成源文件有变化的模块
  --scope=...     限定扫描范围 (backend / frontend)
  --out=<dir>     输出目录 (默认 docs/wiki)
  --help, -h      显示帮助
`);
    return;
  }
  const incremental = args.includes("--incremental");
  const outArg = args.find((a) => a.startsWith("--out="));
  const out = outArg ? path.resolve(ROOT, outArg.split("=")[1]) : DEFAULT_OUT;

  const scopeArg = args.find((a) => a.startsWith("--scope="));
  const scopes = scopeArg ? [scopeArg.split("=")[1]] : ["backend", "frontend"];

  console.log(`[wiki] 扫描范围: ${scopes.join(", ")} | 输出: ${out}`);

  let modules: ModuleDoc[] = [];
  for (const s of scopes) {
    if (s === "backend") modules.push(...scanBackend());
    if (s === "frontend") modules.push(...scanFrontend());
  }

  const state = loadState();
  const changed: ModuleDoc[] = [];
  for (const m of modules) {
    const srcFiles = m.files.map((f) => path.join(ROOT, f.rel));
    const mt = newestMtime(srcFiles);
    const prev = state[m.id] ?? 0;
    if (!incremental || mt > prev) changed.push(m);
    state[m.id] = mt;
  }

  fs.mkdirSync(path.join(out, "modules"), { recursive: true });

  const toWrite = incremental ? changed : modules;
  for (const m of toWrite) {
    fs.writeFileSync(path.join(out, "modules", `${m.id}.md`), renderModule(m));
    console.log(`[wiki] 生成模块: ${m.id}`);
  }
  if (incremental && changed.length === 0) console.log("[wiki] 无变化，跳过模块生成");

  // INDEX 与 architecture 总是随最新全集刷新（成本低）
  fs.writeFileSync(path.join(out, "INDEX.md"), renderIndex(modules, out));
  fs.writeFileSync(path.join(out, "architecture.md"), renderArchitecture(modules));
  console.log("[wiki] 生成 INDEX.md + architecture.md");

  // GC: 清理不再对应的模块文档（如分组逻辑调整后残留的旧 id）
  gcStaleModules(out, modules, scopes);

  saveState(pruneState(state, modules));
  console.log(`[wiki] 完成，共 ${modules.length} 个模块（本次写入 ${toWrite.length}）`);
}

/** 删除 modules/ 下不属于当前有效 id 集合的残留文档。 */
function gcStaleModules(out: string, modules: ModuleDoc[], scopes: string[]) {
  const valid = new Set(modules.map((m) => m.id));
  const dir = path.join(out, "modules");
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const id = f.replace(/\.md$/, "");
    if (valid.has(id)) continue;
    // 仅当该残留属于本次扫描的 scope 时才清理，避免误删未扫描 scope 的产物
    const scope = id.split("-")[0];
    if (!scopes.includes(scope)) continue;
    fs.rmSync(path.join(dir, f));
    console.log(`[wiki] 清理残留模块文档: ${id}`);
  }
}

/** 从 state 中移除已不存在的模块记录。 */
function pruneState(state: Record<string, number>, modules: ModuleDoc[]): Record<string, number> {
  const valid = new Set(modules.map((m) => m.id));
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(state)) if (valid.has(k)) next[k] = v;
  return next;
}

main();
