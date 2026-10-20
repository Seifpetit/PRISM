import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function compileLocal(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadHorizontalTray() {
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "@/lib/h") return { h: React.createElement };
    throw new Error(`Unexpected component dependency: ${specifier}`);
  };
  new Function("require", "module", "exports", compileLocal("./ui/horizontal-tray.tsx"))(
    localRequire,
    module,
    module.exports,
  );
  return module.exports.HorizontalTray;
}

function loadSurface() {
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === "@/lib/h") return { h: React.createElement };
    throw new Error(`Unexpected component dependency: ${specifier}`);
  };
  new Function("require", "module", "exports", compileLocal("./ui/surface.tsx"))(
    localRequire,
    module,
    module.exports,
  );
  return module.exports.Surface;
}

function loadTrayComponent() {
  const compiled = compileLocal("./target-avatar-tray.tsx");
  const module = { exports: {} };
  const HorizontalTray = loadHorizontalTray();
  const Surface = loadSurface();
  const localRequire = (specifier) => {
    if (specifier === "react") return React;
    if (specifier === "lucide-react") {
      return {
        UserRound: (props) => React.createElement("svg", { ...props, "data-profile-icon": "UserRound" }),
        Settings2: (props) => React.createElement("svg", { ...props, "data-profile-icon": "Settings2" }),
      };
    }
    if (specifier === "@/components/prism-action") {
      return {
        PrismAction: ({ children, state, logo }) =>
          React.createElement(
            "button",
            { "data-prism-state": state, "data-prism-logo": logo !== false },
            children,
          ),
      };
    }
    if (specifier === "@/components/ui/horizontal-tray") return { HorizontalTray };
    if (specifier === "@/components/ui/surface") return { Surface };
    if (specifier === "@/types/strategy") return { TARGET_AVATAR_COUNT_BOUNDS: { min: 3, max: 20, default: 10 } };
    if (specifier === "@/lib/h") return { h: React.createElement };
    throw new Error(`Unexpected component dependency: ${specifier}`);
  };
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return module.exports.TargetAvatarTray;
}

const TargetAvatarTray = loadTrayComponent();

function avatar(index) {
  return {
    id: `avatar-${index}`,
    label: `Profile ${index}`,
    gender: "female",
    ageRange: "28-34",
    profession: "Marketing manager",
    lifeRhythm: "Long workdays and limited time to wind down in the evening.",
    painPoint: "Recurring discomfort during limited rest.",
    productConnection: "The product is positioned to reduce that nightly discomfort.",
    priorities: "Convenience and credible comfort.",
    buyingContext: "Compares practical comfort products online.",
  };
}

const baseProps = { count: 10, onCountChange() {} };

test("Target Avatar tray renders its empty state", () => {
  const html = renderToStaticMarkup(
    React.createElement(TargetAvatarTray, { ...baseProps, avatars: [], onGenerate() {} }),
  );
  assert.match(html, /Target Avatars/);
  assert.match(html, /No target avatars yet/);
});

test("Target Avatar tray renders multiple people as UserRound icons", () => {
  const avatars = Array.from({ length: 12 }, (_, index) => avatar(index + 1));
  const html = renderToStaticMarkup(
    React.createElement(TargetAvatarTray, { ...baseProps, avatars, onGenerate() {} }),
  );
  assert.equal((html.match(/data-profile-icon="UserRound"/g) ?? []).length, 12);
  assert.match(html, /Profile 1/);
  assert.match(html, /Profile 12/);
});

test("Target Avatar tray uses a native non-wrapping horizontal scroll region", () => {
  const html = renderToStaticMarkup(
    React.createElement(TargetAvatarTray, {
      ...baseProps,
      avatars: Array.from({ length: 15 }, (_, index) => avatar(index + 1)),
      onGenerate() {},
    }),
  );
  assert.match(html, /target-avatar-scroll/);
  assert.match(html, /flex-nowrap/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /overflow-y-hidden/);
  assert.match(html, /whitespace-nowrap/);
  assert.match(html, /aria-label="Target Avatar profiles"/);
});

test("Target Avatar tray's Generate action has no logo mark and a config gear", () => {
  const html = renderToStaticMarkup(
    React.createElement(TargetAvatarTray, { ...baseProps, avatars: [], onGenerate() {} }),
  );
  assert.match(html, /data-prism-logo="false"/);
  assert.match(html, /data-profile-icon="Settings2"/);
  assert.match(html, /Generation settings/);
});
