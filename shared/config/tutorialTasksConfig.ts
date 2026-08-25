export type TutorialProgressSource =
  | 'coinsCollected'
  | 'visitorsLifted'
  | 'workersHired'
  | 'floorsBuilt'
  | 'dailyTasksClaimed'
  | 'elevatorUpgraded'
  | 'lobbyUpgraded'
  | 'floorUpgraded'
  | 'inviteSent'
  | 'businessUpgraded';

export type TutorialTaskConfig = {
  key: string;
  title: string;
  description: string;
  progressSource: TutorialProgressSource;
  threshold: number;
  reward: { coins: number; gems: number };
};

export const FINAL_REWARD = { coins: 5000, gems: 20 };

export const TUTORIAL_TASKS: TutorialTaskConfig[] = [
  { key: 'hire_workers',          title: 'Staff Up',           description: 'Hire 3 workers. Any worker beats an empty slot — you can swap them anytime.',                progressSource: 'workersHired',       threshold: 3,   reward: { coins: 500, gems: 0 } },
  { key: 'lift_visitors',         title: 'Elevator Operator',  description: 'Lift 30 visitors in the elevator',             progressSource: 'visitorsLifted',     threshold: 30,  reward: { coins: 0,   gems: 1 } },
  { key: 'collect_revenue',       title: 'Collect Revenue',    description: 'Collect revenue from your floors 10 times',   progressSource: 'coinsCollected',     threshold: 10,  reward: { coins: 500, gems: 0 } },
  { key: 'build_floor',           title: 'Going Higher',       description: 'Build a new floor — reach floor 5',           progressSource: 'floorsBuilt',        threshold: 1,   reward: { coins: 0,   gems: 2 } },
  { key: 'complete_daily_tasks',  title: 'Daily Grind',        description: 'Complete 3 daily tasks',                       progressSource: 'dailyTasksClaimed',  threshold: 3,   reward: { coins: 800, gems: 0 } },
  { key: 'upgrade_elevator',      title: 'Speed Boost',        description: 'Upgrade the elevator',                         progressSource: 'elevatorUpgraded',   threshold: 1,   reward: { coins: 0,   gems: 2 } },
  { key: 'upgrade_lobby',         title: 'Grand Lobby',        description: 'Upgrade the lobby',                            progressSource: 'lobbyUpgraded',      threshold: 1,   reward: { coins: 0,   gems: 1 } },
  { key: 'upgrade_floor',         title: 'Level Up',           description: 'Upgrade one of your floors to level 2',        progressSource: 'floorUpgraded',      threshold: 1,   reward: { coins: 0,   gems: 1 } },
  { key: 'invite_friend',         title: 'Bring a Friend',     description: 'Send an invite link to a friend',              progressSource: 'inviteSent',         threshold: 1,   reward: { coins: 0,   gems: 3 } },
  { key: 'upgrade_business',      title: 'Business Pro',       description: 'Upgrade one business category',                progressSource: 'businessUpgraded',   threshold: 1,   reward: { coins: 0,   gems: 5 } },
];

export type TutorialProgressState = Record<TutorialProgressSource, number>;

export function getTutorialDelta(
  progress: TutorialProgressState,
  snapshot: Record<string, number>,
  source: TutorialProgressSource,
): number {
  return Math.max(0, (progress[source] ?? 0) - (snapshot[source] ?? 0));
}
