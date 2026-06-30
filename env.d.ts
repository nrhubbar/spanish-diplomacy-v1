declare module "*.scss";

declare module "*.svg?raw" {
  const source: string;
  export default source;
}
