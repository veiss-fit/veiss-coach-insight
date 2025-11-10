export interface Athlete {
  id: string;
  name: string;
  sport: string;
  group: string;
  level: string;
  avgVelocity: number;
  rom: number;
  tempo: number;
  attendance: number;
  loadRec: string;
  engagement: "High" | "Moderate" | "Low";
}

export interface Session {
  date: string;
  reps: number;
  avgVelocity: number;
  peakVelocity: number;
  rom: number;
  tempo: number;
}

export interface PerformanceData {
  date: string;
  velocity: number;
  rom: number;
  tempo: number;
}

export const mockAthletes: Athlete[] = [
  {
    id: "1",
    name: "Alex Carter",
    sport: "Football",
    group: "Offense",
    level: "Varsity",
    avgVelocity: 1.92,
    rom: 48,
    tempo: 2.8,
    attendance: 94,
    loadRec: "+5%",
    engagement: "High",
  },
  {
    id: "2",
    name: "Jordan Lee",
    sport: "Basketball",
    group: "Guard",
    level: "JV",
    avgVelocity: 1.65,
    rom: 42,
    tempo: 3.1,
    attendance: 88,
    loadRec: "Maintain",
    engagement: "Moderate",
  },
  {
    id: "3",
    name: "Emma Smith",
    sport: "Soccer",
    group: "Forward",
    level: "Varsity",
    avgVelocity: 1.78,
    rom: 46,
    tempo: 2.6,
    attendance: 100,
    loadRec: "-10%",
    engagement: "High",
  },
  {
    id: "4",
    name: "Marcus Johnson",
    sport: "Football",
    group: "Defense",
    level: "Varsity",
    avgVelocity: 1.85,
    rom: 51,
    tempo: 2.9,
    attendance: 91,
    loadRec: "+3%",
    engagement: "High",
  },
  {
    id: "5",
    name: "Sofia Rodriguez",
    sport: "Volleyball",
    group: "Setter",
    level: "Varsity",
    avgVelocity: 1.71,
    rom: 44,
    tempo: 2.7,
    attendance: 97,
    loadRec: "Maintain",
    engagement: "High",
  },
  {
    id: "6",
    name: "Tyler Brooks",
    sport: "Basketball",
    group: "Forward",
    level: "Varsity",
    avgVelocity: 1.88,
    rom: 49,
    tempo: 2.5,
    attendance: 85,
    loadRec: "+8%",
    engagement: "Moderate",
  },
  {
    id: "7",
    name: "Maya Patel",
    sport: "Soccer",
    group: "Midfielder",
    level: "JV",
    avgVelocity: 1.62,
    rom: 40,
    tempo: 3.2,
    attendance: 92,
    loadRec: "+2%",
    engagement: "Moderate",
  },
  {
    id: "8",
    name: "Chris Anderson",
    sport: "Football",
    group: "Offense",
    level: "JV",
    avgVelocity: 1.75,
    rom: 45,
    tempo: 3.0,
    attendance: 89,
    loadRec: "Maintain",
    engagement: "High",
  },
  {
    id: "9",
    name: "Isabella Chen",
    sport: "Volleyball",
    group: "Hitter",
    level: "Varsity",
    avgVelocity: 1.82,
    rom: 47,
    tempo: 2.6,
    attendance: 96,
    loadRec: "+4%",
    engagement: "High",
  },
  {
    id: "10",
    name: "David Martinez",
    sport: "Basketball",
    group: "Center",
    level: "Varsity",
    avgVelocity: 1.69,
    rom: 43,
    tempo: 3.3,
    attendance: 83,
    loadRec: "-5%",
    engagement: "Low",
  },
  {
    id: "11",
    name: "Olivia Thompson",
    sport: "Soccer",
    group: "Defense",
    level: "Varsity",
    avgVelocity: 1.73,
    rom: 44,
    tempo: 2.9,
    attendance: 98,
    loadRec: "Maintain",
    engagement: "High",
  },
  {
    id: "12",
    name: "James Wilson",
    sport: "Football",
    group: "Defense",
    level: "JV",
    avgVelocity: 1.79,
    rom: 46,
    tempo: 2.8,
    attendance: 87,
    loadRec: "+6%",
    engagement: "Moderate",
  },
];

export const generatePerformanceHistory = (athleteId: string): PerformanceData[] => {
  const athlete = mockAthletes.find((a) => a.id === athleteId);
  if (!athlete) return [];

  const data: PerformanceData[] = [];
  const today = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const variance = (Math.random() - 0.5) * 0.3;
    data.push({
      date: date.toISOString().split("T")[0],
      velocity: parseFloat((athlete.avgVelocity + variance).toFixed(2)),
      rom: Math.round(athlete.rom + (Math.random() - 0.5) * 8),
      tempo: parseFloat((athlete.tempo + (Math.random() - 0.5) * 0.6).toFixed(1)),
    });
  }

  return data;
};

export const generateSessionLogs = (athleteId: string): Session[] => {
  const athlete = mockAthletes.find((a) => a.id === athleteId);
  if (!athlete) return [];

  const sessions: Session[] = [];
  const today = new Date();

  for (let i = 14; i >= 0; i -= 2) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    sessions.push({
      date: date.toISOString().split("T")[0],
      reps: Math.floor(Math.random() * 20) + 30,
      avgVelocity: parseFloat((athlete.avgVelocity + (Math.random() - 0.5) * 0.2).toFixed(2)),
      peakVelocity: parseFloat((athlete.avgVelocity + Math.random() * 0.5).toFixed(2)),
      rom: Math.round(athlete.rom + (Math.random() - 0.5) * 5),
      tempo: parseFloat((athlete.tempo + (Math.random() - 0.5) * 0.4).toFixed(1)),
    });
  }

  return sessions.reverse();
};

export const teamStats = {
  activeAthletes: 28,
  avgVelocity: 1.76,
  avgROM: 46,
  avgTempo: 2.9,
  loadRecIndex: "+5%",
};

export const weeklyStats = {
  totalSessions: 142,
  avgTeamLoad: 87,
  topPerformer: "Emma Smith",
  lowestAttendance: 83,
};
