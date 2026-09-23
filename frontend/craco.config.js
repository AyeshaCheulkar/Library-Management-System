const path = require("path");

const SHARED = path.resolve(__dirname, "../shared");

module.exports = {
  webpack: {
    configure(config) {
      config.resolve.plugins = (config.resolve.plugins || []).filter(
        (plugin) => plugin.constructor.name !== "ModuleScopePlugin"
      );

      const oneOf = config.module.rules.find((rule) => Array.isArray(rule.oneOf))?.oneOf ?? [];
      for (const rule of oneOf) {
        if (rule.loader && rule.loader.includes("babel-loader") && rule.include) {
          rule.include = [].concat(rule.include, SHARED);
        }
      }

      config.resolve.extensions = Array.from(
        new Set([...(config.resolve.extensions || []), ".ts", ".tsx"])
      );

      return config;
    },
  },
};
