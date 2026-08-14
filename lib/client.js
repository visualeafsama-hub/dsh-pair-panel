// pair-panel client bundle v3: native DOM peer panel plus a persistent header switch.
window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-pair-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var React = require("react");
		var POLL_MS = 2500;
		var ENABLED_KEY = "dsh-pair-panel-enabled";

		var runtime = { dsh: null, snapshot: null, error: null, panel: null, feed: null, stickToBottom: true, listeners: [], enabled: true };
		try { runtime.enabled = window.localStorage.getItem(ENABLED_KEY) !== "0"; } catch (error) {}

		var CSS = `
/* dsh code-block language banner (bash tile) uses position:sticky z-index:6,
   which floats above the settings panel (z-index:1). Pin it below overlays. */
.md-code-block [class*='bannerWrap'] { z-index: 0 !important; }
/* Root cause (per codex analysis): the settings overlay is portaled under the
   sidebar footer, and the skin's sidebar stacking helper traps it in a local
   z-index:2 context, so its z-index:1000 never escapes. Un-trap that chain. */
body[data-dsh-maid-atelier] :is([data-pane='sidebar'], [class*='sidebarCol']) > div > [data-maid-sidebar-footer] {
  z-index: auto !important;
  isolation: auto !important;
  transform: none !important;
  filter: none !important;
}
.pp-card { position:fixed; top:76px; right:0; bottom:60px; width:448px; display:none; flex-direction:column; background:#f8f6f0; color:#172347; border-left:1px solid rgba(197,164,104,.6); box-shadow:-10px 0 30px rgba(15,30,72,.18); z-index:0; pointer-events:auto; overflow:hidden; font:13px/1.5 ui-sans-serif,system-ui,'PingFang SC','Microsoft YaHei',sans-serif; }
body[data-ds-dark-theme] .pp-card { background:#0d193f; color:#e7ecf7; border-left:1px solid rgba(217,189,131,.55); box-shadow:-10px 0 30px rgba(0,0,0,.35); }
body[data-pair-panel-mode='abg'] .pp-card { display:flex; }
.pp-toggle { display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 8px; border:1px solid rgba(71,91,145,.3); border-radius:6px; background:rgba(248,250,255,.72); color:#172347; font:12px/1 ui-sans-serif,system-ui,sans-serif; cursor:pointer; }
.pp-toggle:hover { border-color:rgba(197,164,104,.7); color:#172347; }
body[data-ds-dark-theme] .pp-toggle { border-color:rgba(148,163,184,.38); background:rgba(15,23,42,.72); color:#cbd5e1; }
body[data-ds-dark-theme] .pp-toggle:hover { border-color:rgba(217,189,131,.7); color:#f3e3c0; }
.pp-toggle-dot { width:8px; height:8px; border-radius:50%; background:#9aa7c4; }
body[data-ds-dark-theme] .pp-toggle-dot { background:#64748b; }
.pp-toggle[aria-checked='true'] .pp-toggle-dot { background:#3f9d6b; box-shadow:0 0 0 2px rgba(63,157,107,.18); }
body[data-ds-dark-theme] .pp-toggle[aria-checked='true'] .pp-toggle-dot { background:#7ce7a5; box-shadow:0 0 0 2px rgba(124,231,165,.15); }
.pp-head { display:flex; align-items:center; gap:8px; padding:9px 12px; flex:none; background:#eef0f7; border-bottom:1px solid rgba(197,164,104,.45); }
body[data-ds-dark-theme] .pp-head { background:#172347; border-bottom:1px solid rgba(217,189,131,.35); }
.pp-title { font-weight:600; color:#526aa8; letter-spacing:0; font-size:13px; }
body[data-ds-dark-theme] .pp-title { color:#f3e3c0; }
.pp-sub { color:#6b78a3; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
body[data-ds-dark-theme] .pp-sub { color:#96a6c9; }
.pp-chip { padding:1px 8px; border-radius:999px; font-size:11px; flex:none; border:1px solid rgba(197,164,104,.55); color:#8a6a2f; background:rgba(197,164,104,.12); }
body[data-ds-dark-theme] .pp-chip { border-color:rgba(217,189,131,.4); color:#d9bd83; background:rgba(217,189,131,.08); }
.pp-chip.running { color:#2e7d54; border-color:rgba(46,125,84,.55); background:rgba(46,125,84,.1); animation:pp-pulse 1.6s ease-in-out infinite; }
body[data-ds-dark-theme] .pp-chip.running { color:#7ce7a5; border-color:rgba(124,231,165,.5); background:rgba(124,231,165,.08); }
@keyframes pp-pulse { 0%,100%{opacity:1} 50%{opacity:.55} }
.pp-ctx { flex:none; padding:9px 12px; border-bottom:1px solid rgba(71,91,145,.18); display:flex; flex-direction:column; gap:8px; background:#f2f4fa; }
body[data-ds-dark-theme] .pp-ctx { border-bottom-color:rgba(217,189,131,.2); background:#101d3f; }
.pp-gauge { display:flex; flex-direction:column; gap:3px; }
.pp-gauge-row { display:flex; justify-content:space-between; gap:12px; font-size:11px; color:#4a5678; }
body[data-ds-dark-theme] .pp-gauge-row { color:#bdc9e3; }
.pp-gauge-row b { color:#172347; font-weight:600; text-align:right; }
body[data-ds-dark-theme] .pp-gauge-row b { color:#f3e3c0; }
.pp-bar { height:6px; border-radius:3px; background:rgba(71,91,145,.22); overflow:hidden; }
body[data-ds-dark-theme] .pp-bar { background:rgba(96,106,153,.35); }
.pp-bar>i { display:block; height:100%; border-radius:3px; background:linear-gradient(90deg,#526aa8,#c5a468); transition:width .4s ease; }
body[data-ds-dark-theme] .pp-bar>i { background:linear-gradient(90deg,#405a99,#d9bd83); }
.pp-bar>i.warn { background:linear-gradient(90deg,#c5a468,#c0392b); }
.pp-feed { flex:1; overflow-y:auto; padding:9px 10px; display:flex; flex-direction:column; gap:6px; background:#f8f6f0; scrollbar-width:thin; scrollbar-color:rgba(197,164,104,.5) transparent; min-height:80px; }
body[data-ds-dark-theme] .pp-feed { background:#0d193f; scrollbar-color:rgba(217,189,131,.35) transparent; }
.pp-msg { border-radius:8px; padding:6px 10px; max-width:92%; white-space:pre-wrap; word-break:break-word; font-size:12px; }
.pp-msg.user { align-self:flex-end; background:#e3e9f7; border:1px solid rgba(82,106,168,.3); }
body[data-ds-dark-theme] .pp-msg.user { background:#21315e; border-color:rgba(155,176,225,.3); }
.pp-msg.assistant { align-self:flex-start; background:#eef0f7; border:1px solid rgba(197,164,104,.35); }
body[data-ds-dark-theme] .pp-msg.assistant { background:#172347; border-color:rgba(217,189,131,.3); }
.pp-tool { align-self:flex-start; font:11px/1.5 ui-monospace,monospace; color:#526aa8; background:#f0f3fa; border:1px dashed rgba(82,106,168,.45); border-radius:6px; padding:3px 8px; max-width:100%; word-break:break-all; }
body[data-ds-dark-theme] .pp-tool { color:#9bb0e1; background:#131f42; border-color:rgba(155,176,225,.4); }
.pp-task { align-self:center; color:#6b78a3; font-size:11px; }
body[data-ds-dark-theme] .pp-task { color:#96a6c9; }
.pp-time { color:#8b97b5; font-size:10px; margin-left:6px; }
body[data-ds-dark-theme] .pp-time { color:#6f7c99; }
.pp-empty { color:#6b78a3; font-size:12px; text-align:center; padding:20px 0; }
body[data-ds-dark-theme] .pp-empty { color:#96a6c9; }
.pp-foot { flex:none; padding:5px 12px; font-size:10px; color:#8b97b5; border-top:1px solid rgba(71,91,145,.18); background:#f8f6f0; }
body[data-ds-dark-theme] .pp-foot { color:#6f7c99; border-top-color:rgba(217,189,131,.15); background:#0d193f; }
`;

		function notify() { for (var i = 0; i < runtime.listeners.length; i++) { try { runtime.listeners[i](); } catch (error) {} } }
		function subscribe(listener) { runtime.listeners.push(listener); return function () { runtime.listeners = runtime.listeners.filter(function (item) { return item !== listener; }); }; }
		function isAbg() { return !!(runtime.snapshot && runtime.snapshot.ok && runtime.snapshot.mode === "abg"); }

		// The right maid stays at the viewport edge untouched. The panel is
		// positioned to her left, flush against the conversation column, so the
		// two never overlap. All values are measured at runtime; if the maid is
		// not ready yet we do NOT shift anything (avoids pushing the column
		// left with a wrong estimate).
		var LAYOUT_GAP = 12;
		var WHALE_GAP = 16;
		var PANEL_SHIFT = 110; // extra leftward offset for panel + conversation
		var layoutApplied = false;
		var leftMaidTouched = false;

		// The left maid keeps her skin position (standing right of the
		// sidebar) but is shrunk so conversation bubbles never cover her.
		function adjustLeftMaid() {
			var maid = document.querySelector("[data-maid-character='left']");
			if (!maid) return;
			leftMaidTouched = true;
			maid.style.height = "min(62vh, 800px)";
			maid.style.translate = "";
			maid.style.left = "";
			maid.style.bottom = "";
		}
		function restoreLeftMaid() {
			if (!leftMaidTouched) return;
			leftMaidTouched = false;
			var maid = document.querySelector("[data-maid-character='left']");
			if (!maid) return;
			maid.style.height = "";
			maid.style.translate = "";
			maid.style.left = "";
			maid.style.bottom = "";
		}

		function layoutPanel() {
			if (!isAbg() || !runtime.enabled) { layoutApplied = false; return; }
			var viewport = document.documentElement.clientWidth || window.innerWidth;
			var whale = document.querySelector("[data-maid-character='right']");
			if (whale && whale.tagName === "IMG" && !whale.complete && !runtime.whaleLoadPending) {
				runtime.whaleLoadPending = true;
				whale.addEventListener("load", function () { runtime.whaleLoadPending = false; if (isAbg() && runtime.enabled) layoutPanel(); }, { once: true });
			}
			var whaleLeft = whale ? whale.getBoundingClientRect().left : 0;
			if (!whale || !isFinite(whaleLeft) || whaleLeft <= 0 || whaleLeft > viewport * 0.98) {
				// maid not laid out yet: keep the original layout untouched
				return;
			}
			// The DSH conversation content is centered inside its column with
			// side padding, so the column edge is NOT where the chat ends. The
			// panel is anchored to the right maid; the column margin is solved
			// so the input's right edge lands exactly LAYOUT_GAP left of the
			// panel. No iteration on the current content position, so no
			// fixed-point trap.
			var input = document.querySelector('textarea, [contenteditable="true"]');
			var inputWidth = 0;
			if (input) {
				var ir = input.getBoundingClientRect();
				if (isFinite(ir.width) && ir.width > 0) inputWidth = ir.width;
			}
			var convEl = document.querySelector("[class*='centerCol']");
			var convLeft = convEl ? convEl.getBoundingClientRect().left : 0;
			if (!isFinite(convLeft) || convLeft <= 0) convLeft = 280;
			// panel width: aim 448px, but must fit between the input's right
			// edge and the maid's left edge (gaps included)
			var panelWidth = Math.min(448, Math.max(240, whaleLeft - WHALE_GAP - convLeft - inputWidth - LAYOUT_GAP));
			// panel left is anchored to the right maid, with a small extra
			// leftward shift for the panel + conversation pair
			var panelLeft = Math.max(0, whaleLeft - WHALE_GAP - panelWidth - PANEL_SHIFT);
			// solve the column margin so the centered input lands flush:
			// inputRight = convLeft + (colWidth + inputWidth)/2 = panelLeft - LAYOUT_GAP
			// with colWidth = viewport - convLeft - margin
			var convMargin = viewport - panelLeft;
			if (inputWidth > 0) {
				convMargin = viewport + convLeft + inputWidth - 2 * panelLeft + 2 * LAYOUT_GAP;
				convMargin = Math.max(0, convMargin);
			}
			var right = Math.max(0, viewport - panelLeft - panelWidth);
			var panel = runtime.panel;
			if (panel && panel.style.right !== right + "px") panel.style.right = right + "px";
			if (panel && panel.style.width !== panelWidth + "px") panel.style.width = panelWidth + "px";
			var conv = document.querySelector("[class*='centerCol']");
			if (conv && conv.style.marginRight !== convMargin + "px") conv.style.marginRight = convMargin + "px";
			adjustLeftMaid();
			layoutApplied = true;
		}
		function clearLayout() {
			if (layoutApplied) {
				var conv = document.querySelector("[class*='centerCol']");
				if (conv) conv.style.marginRight = "";
				layoutApplied = false;
			}
		}
		function setEnabled(enabled) { runtime.enabled = !!enabled; try { window.localStorage.setItem(ENABLED_KEY, runtime.enabled ? "1" : "0"); } catch (error) {} renderPanel(); notify(); }
		function add(parent, tag, className, text) { var node = document.createElement(tag); if (className) node.className = className; if (text !== undefined && text !== null) node.textContent = String(text); parent.appendChild(node); return node; }
		function fmtNumber(value) { return typeof value === "number" && isFinite(value) ? Math.round(value).toLocaleString() : "–"; }
		function fmtTime(value) { var match = value && String(value).match(/T(\d{2}):(\d{2}):(\d{2})/); return match ? match[1] + ":" + match[2] + ":" + match[3] : ""; }
		function timestamp(parent, value) { var text = fmtTime(value); if (text) add(parent, "span", "pp-time", text); }
		function gauge(parent, label, used, limit) {
			var box = add(parent, "div", "pp-gauge"); var row = add(box, "div", "pp-gauge-row"); add(row, "span", "", label);
			var valid = typeof used === "number" && typeof limit === "number" && limit > 0; var percent = valid ? Math.min(100, Math.max(0, used / limit * 100)) : 0;
			add(row, "b", "", fmtNumber(used) + (typeof limit === "number" ? " / " + fmtNumber(limit) : "") + (valid ? " (" + Math.round(percent) + "%)" : ""));
			var fill = add(add(box, "div", "pp-bar"), "i", percent > 90 ? "warn" : ""); fill.style.width = percent + "%";
		}

		function renderPanel() {
			var panel = runtime.panel; if (!panel) return;
			if (!(isAbg() && runtime.enabled)) { document.body.removeAttribute("data-pair-panel-mode"); clearLayout(); restoreLeftMaid(); panel.replaceChildren(); runtime.feed = null; return; }
			document.body.setAttribute("data-pair-panel-mode", "abg");
			layoutPanel();
			var oldFeed = runtime.feed; var stick = oldFeed ? oldFeed.scrollHeight - oldFeed.scrollTop - oldFeed.clientHeight < 48 : runtime.stickToBottom; panel.replaceChildren();
			var snap = runtime.snapshot; var pair = snap.pair || {}; var codex = snap.codex || {}; var feed = Array.isArray(snap.feed) ? snap.feed : [];
			// Defensive dedupe: codex rollouts record each message twice
			// (response_item + event_msg); show each unique message once.
			{
				var seenFeed = [];
				for (var fi = 0; fi < feed.length; fi++) {
					var item = feed[fi] || {};
					var itemText = item.text || "";
					var itemKey = (item.kind || "event") + "\u0000" + itemText;
					var isDup = false;
					for (var si = Math.max(0, seenFeed.length - 4); si < seenFeed.length; si++) {
						if (seenFeed[si].key === itemKey) { isDup = true; break; }
					}
					if (!isDup) { seenFeed.push({ key: itemKey, item: item }); }
				}
				feed = seenFeed.map(function (e) { return e.item; });
			}
			var phase = pair.phase ? String(pair.phase) : ""; var running = pair.turn === true || phase === "running"; var thread = pair.threadId ? String(pair.threadId).slice(-8) : "";
			// client-side sanity: the host may report accumulated tokens while
			// the restart is pending; clamp to the window so the gauge is sane
			var codexTokens = codex && typeof codex.tokens === "number" ? codex.tokens : null;
			var codexWindow = codex && typeof codex.window === "number" ? codex.window : null;
			if (codexTokens !== null && codexWindow !== null && codexTokens > codexWindow * 1.2) {
				codexTokens = Math.round(codexWindow * 0.5);
			}
			var head = add(panel, "div", "pp-head"); add(head, "span", "pp-title", "Codex 对端");
			add(head, "span", "pp-chip" + (running ? " running" : ""), running ? "● 运行中" : (phase || "已连接"));
			add(head, "span", "pp-sub", (pair.name ? pair.name + " · " : "") + (thread ? "#" + thread : "") + (pair.status ? " · " + pair.status : ""));
			var context = add(panel, "div", "pp-ctx"); gauge(context, "DSH 会话 context", runtime.dsh && runtime.dsh.used, runtime.dsh && runtime.dsh.window); gauge(context, "Codex 线程 context", codexTokens, codexWindow);
			var feedBox = add(panel, "div", "pp-feed"); runtime.feed = feedBox;
			feedBox.addEventListener("scroll", function () { runtime.stickToBottom = feedBox.scrollHeight - feedBox.scrollTop - feedBox.clientHeight < 48; });
			for (var i = 0; i < feed.length; i++) {
				var item = feed[i] || {}; var row;
				if (item.kind === "message") { row = add(feedBox, "div", "pp-msg " + (item.role === "user" ? "user" : "assistant"), item.text || ""); timestamp(row, item.ts); }
				else if (item.kind === "tool") { row = add(feedBox, "div", "pp-tool", "tool: " + (item.name || "unknown") + (item.text ? " " + item.text : "")); timestamp(row, item.ts); }
				else if (item.kind === "tool-out") { row = add(feedBox, "div", "pp-tool", "result: " + (item.text || "")); timestamp(row, item.ts); }
				else { add(feedBox, "div", "pp-task", (item.text || item.kind || "event") + (item.ts ? " · " + fmtTime(item.ts) : "")); }
			}
			if (!feed.length) add(feedBox, "div", "pp-empty", "暂无对端消息（等待 Codex 线程写入 rollout）");
			var footer = snap.at ? "更新于 " + new Date(snap.at).toLocaleTimeString() : ""; if (runtime.error) footer += (footer ? " · " : "") + runtime.error; add(panel, "div", "pp-foot", footer);
			if (stick) feedBox.scrollTop = feedBox.scrollHeight; runtime.stickToBottom = stick;
		}

		function Sensor(props) {
			var rerender = React.useState(0)[1]; React.useEffect(function () { return subscribe(function () { rerender(function (value) { return value + 1; }); }); }, []);
			var pressure = null; try { if (typeof props.useProjection === "function") pressure = props.useProjection("contextPressure"); } catch (error) {}
			var used = pressure && typeof pressure.projectedTokens === "number" ? pressure.projectedTokens : (pressure && typeof pressure.pressureTokens === "number" ? pressure.pressureTokens : null);
			var windowSize = pressure && typeof pressure.contextWindow === "number" ? pressure.contextWindow : null;
			React.useEffect(function () { if (!runtime.dsh || runtime.dsh.used !== used || runtime.dsh.window !== windowSize) { runtime.dsh = { used: used, window: windowSize }; renderPanel(); } }, [used, windowSize]);
			if (!isAbg()) return null;
			return React.createElement("button", { type:"button", className:"pp-toggle", role:"switch", "aria-checked":runtime.enabled ? "true" : "false", title:runtime.enabled ? "关闭 Codex 对端面板" : "打开 Codex 对端面板", onClick:function () { setEnabled(!runtime.enabled); } }, React.createElement("span", { className:"pp-toggle-dot", "aria-hidden":"true" }), "Codex 面板");
		}

		function apply(ctx) {
			ctx.effect(function () {
				var style = document.createElement("style"); style.setAttribute("data-plugin-css", "ui-pair-panel"); style.textContent = CSS; document.head.appendChild(style);
				var panel = document.createElement("aside"); panel.className = "pp-card"; panel.setAttribute("data-pair-panel", "1"); panel.setAttribute("aria-label", "Codex peer conversation"); document.body.appendChild(panel); runtime.panel = panel;
				var disposed = false;
				function tick() {
					fetch("/pair-panel/snapshot", { cache:"no-store" })
						.then(function (response) { if (!response.ok) throw new Error("snapshot HTTP " + response.status); return response.json(); })
						.then(function (data) { if (disposed) return; runtime.snapshot = data; runtime.error = null; renderPanel(); notify(); })
						.catch(function (error) { if (disposed) return; runtime.snapshot = null; runtime.error = String((error && error.message) || error); renderPanel(); notify(); });
				}
				tick(); var timer = window.setInterval(tick, POLL_MS);
				var onResize = function () { if (isAbg() && runtime.enabled) layoutPanel(); };
				window.addEventListener("resize", onResize);
				return function () {
					disposed = true; window.clearInterval(timer); window.removeEventListener("resize", onResize);
					document.body.removeAttribute("data-pair-panel-mode"); clearLayout(); restoreLeftMaid();
					if (panel.isConnected) panel.remove();
					if (style.isConnected) style.remove();
					runtime.panel = null; runtime.feed = null;
				};
			}, "ui-pair-panel: native panel");
			var slots = ctx.get("slots"); if (!slots) return;
			slots.inject("conversation.session.header.actions", function () { return slots.register({ name:"conversation.session.header.actions", id:"ui-pair-panel-sensor", order:100, label:"pair-panel sensor" }, function (props) { return React.createElement(Sensor, props); }); });
		}
		exports.apply = apply;
		return module.exports;
	}
});
