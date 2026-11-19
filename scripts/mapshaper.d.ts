declare module "mapshaper" {
  const mapshaper: { runCommands(commands: string): Promise<void> };
  export default mapshaper;
}
