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
  lobbyCapacity: number;
  hotelCapacity: number;
  elevatorLevel: number;
  workers: WorkerItem[];
  floors: FloorItem[];
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
