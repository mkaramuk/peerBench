import { Command } from "commander";

export const program = new Command("peerbench")
  .allowUnknownOption(true)
  .configureHelp({
    showGlobalOptions: true,
  });

program.configureHelp({
  optionTerm(option) {
    return option.flags;
  },
  subcommandTerm(cmd) {
    return cmd.name();
  },
  commandUsage(cmd) {
    const usage: string[] = [];
    for (let parent = cmd.parent; parent; parent = parent.parent) {
      usage.push(parent.name());
    }
    usage.reverse();
    return `${usage.join(" ")} ${cmd.name()} ${cmd.usage()}`;
  },
});
