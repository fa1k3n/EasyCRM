/* CSS imports are handled by Vite (Tailwind); for the type check they are plain side-effect modules. */
declare module '*.css';

/* The brand folder's extensions, built together with the app by tools/build-app.js (an empty list without any) */
declare module 'virtual:crm-extensions' {
  const extensions: unknown[];
  export default extensions;
}
