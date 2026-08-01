import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@repo/ui") {
      return {
        shortCircuit: true,
        url: new URL("./repo-ui-test-shim.mjs", import.meta.url).href,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith(".module.css")) {
      return nextLoad(url, context);
    }
    return {
      format: "module",
      shortCircuit: true,
      source: `
        const styles = new Proxy({}, {
          get(_target, property) {
            return typeof property === "string" ? property : undefined;
          }
        });
        export default styles;
      `,
    };
  },
});
