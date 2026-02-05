import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        console: "readonly",
        alert: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        URLSearchParams: "readonly",
        Date: "readonly",
        Math: "readonly",
        // Cloudflare Workers globals
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
        Headers: "readonly",
        crypto: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
];
