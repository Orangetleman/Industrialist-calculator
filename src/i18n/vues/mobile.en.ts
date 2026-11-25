// English catalogue, mobile interface (MB3, mobile-shell.ts).
import type { Msg } from "../fr.ts";
import type { mobileFr } from "./mobile.fr.ts";

export const mobileEn: Record<keyof typeof mobileFr, Msg> = {
  "mob.steps": "Steps",
  "mob.sum": "Summary",
  "mob.posts": "Posts",
  "mob.buildings": "Buildings",
  "mob.values": "Values",
  "mob.sent": "Sent",
  "mob.menu": "Menu",
  "mob.goto": "Go to",
  "mob.myplan": "My plan",
  "mob.settings": "Plan settings",
  "mob.remark": "Send feedback",
  "mob.methods": "How it calculates",
  "mob.about": "About and sources",
  "mob.pickgoal": "Choose the goal",
  "mob.link": "Link: tap a node, then the one to link",
  "mob.card": "Full card",
};
