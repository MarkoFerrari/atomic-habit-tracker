// A first icon for an imported habit, from words in its name (H09). Only a starting point:
// the person picks the real one with "Change icon". Unknown names get a neutral sprout.
import type { HabitIcon } from './icons';

const RULES: [RegExp, HabitIcon][] = [
  [/\b(train|gym|workout|lift|strength|weights?)\b/i, 'dumbbell'],
  [/\b(push.?ups?|pull.?ups?|core|abs)\b/i, 'biceps-flexed'],
  [/\b(bike|cycl\w*|ride|spin)\b/i, 'bike'],
  [/\b(run|walk|yoga|stretch\w*|mobility|steps)\b/i, 'person-standing'],
  [/\b(swim\w*|sea|surf)\b/i, 'waves'],
  [/\b(breakfast|coffee|espresso)\b/i, 'coffee'],
  [/\b(water|hydrat\w*)\b/i, 'glass-water'],
  [/\b(read\w*|book)\b/i, 'book-open'],
  [/\b(journal|diary|write|writing)\b/i, 'notebook-pen'],
  [/\b(study|learn\w*|course|class|lesson)\b/i, 'graduation-cap'],
  [/\b(meditat\w*|mindful\w*|breath\w*)\b/i, 'brain'],
  [/\b(sleep|bed|nap)\b/i, 'bed'],
  [/\b(evening|night|wind.?down)\b/i, 'moon'],
  [/\b(lunch|dinner|meal|eat)\b/i, 'utensils'],
  [/\b(cook\w*|bake|baking)\b/i, 'chef-hat'],
  [/\b(music|guitar|piano|sing\w*)\b/i, 'music'],
  [/\b(paint\w*|draw\w*|sketch\w*|art)\b/i, 'palette'],
  [/\b(diorama|build|model|craft|wood\w*)\b/i, 'hammer'],
  [/\b(photo\w*|camera)\b/i, 'camera'],
  [/\b(garden\w*|plants?)\b/i, 'sprout'],
  [/\b(hike|hiking|climb\w*|mountain)\b/i, 'mountain'],
  [/\b(pill|vitamin\w*|medic\w*)\b/i, 'pill'],
];

export function guessHabitIcon(title: string): HabitIcon {
  return RULES.find(([re]) => re.test(title))?.[1] ?? 'sprout';
}
