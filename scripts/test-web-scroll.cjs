// Testes isolados de hooks/render: não substituem Safari nem um navegador real.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");

function renderImport(platform, ready) {
  let stateIndex = 0;
  const scrolls = [];
  const cleanups = [];
  const listeners = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => [stateIndex++ === 5 ? ready : initial, () => {}],
    useRef: () => ({ current: { scrollToEnd: (options) => scrolls.push(options) } }),
    useCallback: (callback) => callback,
  };
  const native = new Proxy({ Platform: { OS: platform }, StyleSheet: { create: (x) => x } }, {
    get: (target, key) => target[key] || key,
  });
  const navigation = { addListener: (event, callback) => {
    listeners.push({ event, callback });
    return () => listeners.pop();
  } };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync("src/screens/XLSXImportScreen.tsx", "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const frames = [];
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: (name) => {
      if (name === "react") return react;
      if (name === "react-native") return native;
      if (name === "@react-navigation/native") return {
        useNavigation: () => navigation,
        useFocusEffect: (callback) => { const cleanup = callback(); if (cleanup) cleanups.push(cleanup); },
      };
      if (name.endsWith("AuthContext")) return { useAuth: () => ({ volunteer: null, selectedPointId: null }) };
      return {};
    },
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelAnimationFrame: () => {},
  });
  const tree = module.exports.default();
  frames.forEach((callback) => callback());
  return { tree, scrolls, listeners, cleanups };
}

function find(tree, type) {
  if (!tree || typeof tree !== "object") return undefined;
  if (tree.type === type) return tree;
  return tree.children?.flat(Infinity).map((child) => find(child, type)).find(Boolean);
}

test("web pronta: foco, fim da transição e layout revelam sincronização", () => {
  const result = renderImport("web", true);
  const scroll = find(result.tree, "ScrollView");
  assert.equal(result.tree.props.style.minHeight, 0);
  assert.equal(scroll.props.style.minHeight, 0);
  assert.equal(result.scrolls.length, 1);
  assert.equal(result.listeners[0].event, "transitionEnd");
  result.listeners[0].callback();
  scroll.props.onContentSizeChange();
  scroll.props.onLayout();
  assert.equal(result.scrolls.length, 4);
  assert.ok(result.scrolls.every((options) => options.animated === false));
  result.cleanups.forEach((cleanup) => cleanup());
  assert.equal(result.listeners.length, 0);
});

test("web incompleta: layout não força rolagem", () => {
  const result = renderImport("web", false);
  const scroll = find(result.tree, "ScrollView");
  scroll.props.onContentSizeChange();
  scroll.props.onLayout();
  assert.equal(result.scrolls.length, 0);
  assert.equal(result.listeners.length, 0);
});

for (const platform of ["ios", "android"]) {
  test(`${platform}: mantém caminho nativo sem autorrolagem`, () => {
    const result = renderImport(platform, true);
    assert.equal(result.tree.type, "KeyboardAvoidingView");
    assert.equal(find(result.tree, "ScrollView").props.onLayout, undefined);
    assert.equal(result.scrolls.length, 0);
    assert.equal(result.listeners.length, 0);
  });
}

test("raiz web limitada ao viewport dinâmico com fallback e safe area interna", () => {
  const app = fs.readFileSync("App.tsx", "utf8");
  assert.match(app, /height: 100vh;\s*height: 100dvh;/);
  assert.match(app, /box-sizing: border-box/);
  assert.doesNotMatch(app, /min-height: 100[vd]vh/);
  assert.match(app, /cardStyle: \{ flex: 1, minHeight: 0, overflow: "hidden" \}/);
});
