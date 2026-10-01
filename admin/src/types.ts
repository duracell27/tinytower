export interface PlayerListItem {
  id: string;
  email: string;
  playerName: string;
  playerLevel: number;
  balance: number;
  gems: number;
  isAdmin: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export interface WorkerItem {
  id: string;
  name: string;
  level: number;
  floorType: string;
  dreamJob: string;
  isSpecialist: boolean;
  assignedFloorId: number | null;
  assignedSlotIdx: number | null;
}

export interface FloorItem {
  floorId: number;
  floorType: string | null;
  stars: number;
  productions: Array<{ slotIdx: number; typeId: string | null; stage: string }>;
}

export interface PlayerDetail {
  id: string;
  email: string;
  playerName: string;
  playerLevel: number;
  playerXp: number;
  isAdmin: boolean;
  balance: number;
  createdAt: string;
  lastSeenAt: string;
  gems: number;
  tools: { briks: number; glass: number; nails: number; screw: number };
  tokens: { green: number; blue: number; yellow: number; purple: number; red: number };
  businessUpgrades: { green: number; blue: number; yellow: number; purple: number; red: number };
  vehicles: { taxi: number; forklift: number; armoredTruck: number; deliveryTruck: number; bus: number };
  lobbyCapacity: number;
  hotelCapacity: number;
  elevatorLevel: number;
  workers: WorkerItem[];
  floors: FloorItem[];
}

export interface PurchaseItem {
  id: string;
  transactionId: string;
  packId: string;
  rcProductId: string;
  status: string;
  priceUsd: number | null;
  gemsGranted: number;
  toolsGranted: unknown;
  tokensGranted: unknown;
  source: string;
  createdAt: string;
}

export interface CityListItem {
  id: string;
  name: string;
  description: string | null;
  cityXp: number;
  memberCount: number;
  buildingCount: number;
  budget: { coins: number; gems: number; briks: number; glass: number; nails: number; screw: number };
  createdAt: string;
}

export interface CityMemberItem {
  playerId: string;
  playerName: string;
  playerLevel: number;
  role: string;
  cityXp: number;
  joinedAt: string;
}

export interface CityBuildingItem {
  buildingType: string;
  level: number;
  state: string;
  buildFinishesAt: string | null;
}

export interface CityDetail {
  id: string;
  name: string;
  description: string | null;
  cityXp: number;
  budget: { coins: number; gems: number; briks: number; glass: number; nails: number; screw: number };
  createdAt: string;
  members: CityMemberItem[];
  buildings: CityBuildingItem[];
}

export interface CommandLogItem {
  id: string;
  playerId: string;
  playerName: string;
  type: string;
  floorId: number | null;
  slotIdx: number | null;
  typeId: string | null;
  workerId: string | null;
  timestamp: string;
  processedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
