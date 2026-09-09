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
  { key: 'hire_workers',          title: 'tutorialTaskItems.hire_workers.title',         description: 'tutorialTaskItems.hire_workers.description',         progressSource: 'workersHired',       threshold: 3,   reward: { coins: 500, gems: 0 } },
  { key: 'lift_visitors',         title: 'tutorialTaskItems.lift_visitors.title',        description: 'tutorialTaskItems.lift_visitors.description',        progressSource: 'visitorsLifted',     threshold: 30,  reward: { coins: 0,   gems: 1 } },
  { key: 'collect_revenue',       title: 'tutorialTaskItems.collect_revenue.title',      description: 'tutorialTaskItems.collect_revenue.description',      progressSource: 'coinsCollected',     threshold: 10,  reward: { coins: 500, gems: 0 } },
  { key: 'build_floor',           title: 'tutorialTaskItems.build_floor.title',          description: 'tutorialTaskItems.build_floor.description',          progressSource: 'floorsBuilt',        threshold: 1,   reward: { coins: 0,   gems: 2 } },
  { key: 'complete_daily_tasks',  title: 'tutorialTaskItems.complete_daily_tasks.title', description: 'tutorialTaskItems.complete_daily_tasks.description', progressSource: 'dailyTasksClaimed',  threshold: 3,   reward: { coins: 800, gems: 0 } },
  { key: 'upgrade_elevator',      title: 'tutorialTaskItems.upgrade_elevator.title',     description: 'tutorialTaskItems.upgrade_elevator.description',     progressSource: 'elevatorUpgraded',   threshold: 1,   reward: { coins: 0,   gems: 2 } },
  { key: 'upgrade_lobby',         title: 'tutorialTaskItems.upgrade_lobby.title',        description: 'tutorialTaskItems.upgrade_lobby.description',        progressSource: 'lobbyUpgraded',      threshold: 1,   reward: { coins: 0,   gems: 1 } },
  { key: 'upgrade_floor',         title: 'tutorialTaskItems.upgrade_floor.title',        description: 'tutorialTaskItems.upgrade_floor.description',        progressSource: 'floorUpgraded',      threshold: 1,   reward: { coins: 0,   gems: 1 } },
  { key: 'invite_friend',         title: 'tutorialTaskItems.invite_friend.title',        description: 'tutorialTaskItems.invite_friend.description',        progressSource: 'inviteSent',         threshold: 1,   reward: { coins: 0,   gems: 3 } },
  { key: 'upgrade_business',      title: 'tutorialTaskItems.upgrade_business.title',     description: 'tutorialTaskItems.upgrade_business.description',     progressSource: 'businessUpgraded',   threshold: 1,   reward: { coins: 0,   gems: 5 } },
];

export type TutorialProgressState = Record<TutorialProgressSource, number>;

export function getTutorialDelta(
  progress: TutorialProgressState,
  snapshot: Record<string, number>,
  source: TutorialProgressSource,
): number {
  return Math.max(0, (progress[source] ?? 0) - (snapshot[source] ?? 0));
}
