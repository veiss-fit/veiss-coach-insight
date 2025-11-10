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

// Football Team (50 players - Boys)
const footballAthletes: Athlete[] = [
  // Varsity Football Offense (15)
  { id: "f1", name: "Marcus Johnson", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.92, rom: 48, tempo: 2.8, attendance: 94, loadRec: "+5%", engagement: "High" },
  { id: "f2", name: "Tyler Brooks", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.88, rom: 49, tempo: 2.5, attendance: 85, loadRec: "+8%", engagement: "Moderate" },
  { id: "f3", name: "Ethan Parker", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.87, rom: 50, tempo: 2.7, attendance: 93, loadRec: "+4%", engagement: "High" },
  { id: "f4", name: "Jackson Rivera", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.85, rom: 47, tempo: 2.9, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "f5", name: "Mason Wright", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.83, rom: 46, tempo: 3.0, attendance: 88, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f6", name: "Logan Foster", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.90, rom: 51, tempo: 2.6, attendance: 96, loadRec: "+6%", engagement: "High" },
  { id: "f7", name: "Carter Hayes", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.86, rom: 48, tempo: 2.8, attendance: 89, loadRec: "+2%", engagement: "Moderate" },
  { id: "f8", name: "Dylan Cooper", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.84, rom: 47, tempo: 2.9, attendance: 92, loadRec: "+4%", engagement: "High" },
  { id: "f9", name: "Austin Morgan", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.81, rom: 45, tempo: 3.1, attendance: 87, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f10", name: "Caleb Bennett", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.89, rom: 50, tempo: 2.7, attendance: 95, loadRec: "+5%", engagement: "High" },
  { id: "f11", name: "Ryan Coleman", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.82, rom: 46, tempo: 2.9, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "f12", name: "Blake Hughes", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.87, rom: 49, tempo: 2.6, attendance: 93, loadRec: "+4%", engagement: "High" },
  { id: "f13", name: "Hunter Price", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.85, rom: 48, tempo: 2.8, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "f14", name: "Brandon Reed", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.80, rom: 44, tempo: 3.0, attendance: 86, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f15", name: "Justin Powell", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.88, rom: 49, tempo: 2.7, attendance: 94, loadRec: "+5%", engagement: "High" },
  
  // Varsity Football Defense (15)
  { id: "f16", name: "Noah Davis", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.81, rom: 47, tempo: 2.9, attendance: 90, loadRec: "+2%", engagement: "High" },
  { id: "f17", name: "James Wilson", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.79, rom: 46, tempo: 2.8, attendance: 87, loadRec: "+6%", engagement: "Moderate" },
  { id: "f18", name: "Alexander King", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.84, rom: 48, tempo: 2.7, attendance: 92, loadRec: "+4%", engagement: "High" },
  { id: "f19", name: "Zachary Scott", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.86, rom: 49, tempo: 2.6, attendance: 94, loadRec: "+5%", engagement: "High" },
  { id: "f20", name: "Gabriel Adams", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.83, rom: 47, tempo: 2.8, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "f21", name: "Isaac Turner", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.78, rom: 45, tempo: 3.0, attendance: 88, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f22", name: "Owen Phillips", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.85, rom: 48, tempo: 2.7, attendance: 93, loadRec: "+4%", engagement: "High" },
  { id: "f23", name: "Lucas Campbell", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.82, rom: 46, tempo: 2.9, attendance: 90, loadRec: "+2%", engagement: "High" },
  { id: "f24", name: "Henry Mitchell", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.80, rom: 45, tempo: 3.0, attendance: 89, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f25", name: "Samuel Roberts", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.87, rom: 50, tempo: 2.6, attendance: 95, loadRec: "+6%", engagement: "High" },
  { id: "f26", name: "Nathan Carter", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.84, rom: 47, tempo: 2.8, attendance: 92, loadRec: "+4%", engagement: "High" },
  { id: "f27", name: "Andrew Evans", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.81, rom: 46, tempo: 2.9, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "f28", name: "Evan Bailey", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.79, rom: 44, tempo: 3.1, attendance: 87, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f29", name: "Christian Wood", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.83, rom: 47, tempo: 2.8, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "f30", name: "Connor Brooks", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.88, rom: 49, tempo: 2.5, attendance: 94, loadRec: "+5%", engagement: "High" },
  
  // JV Football (20)
  { id: "f31", name: "Chris Anderson", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.75, rom: 45, tempo: 3.0, attendance: 89, loadRec: "Maintain", engagement: "High" },
  { id: "f32", name: "Jordan Murphy", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.72, rom: 44, tempo: 2.9, attendance: 88, loadRec: "+2%", engagement: "Moderate" },
  { id: "f33", name: "Cameron Rivera", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.70, rom: 43, tempo: 3.1, attendance: 86, loadRec: "+1%", engagement: "Moderate" },
  { id: "f34", name: "Wyatt Cooper", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.74, rom: 45, tempo: 2.9, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "f35", name: "Gavin Richardson", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.68, rom: 42, tempo: 3.0, attendance: 84, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f36", name: "Tristan Cox", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.76, rom: 46, tempo: 2.8, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "f37", name: "Dominic Howard", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.71, rom: 44, tempo: 3.0, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "f38", name: "Adrian Ward", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.73, rom: 45, tempo: 2.9, attendance: 89, loadRec: "+2%", engagement: "High" },
  { id: "f39", name: "Miles Torres", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.69, rom: 43, tempo: 3.1, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "f40", name: "Brock Jenkins", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.67, rom: 43, tempo: 3.0, attendance: 85, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f41", name: "Ian Peterson", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.75, rom: 45, tempo: 2.9, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "f42", name: "Colin Gray", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.70, rom: 44, tempo: 3.0, attendance: 86, loadRec: "+1%", engagement: "Moderate" },
  { id: "f43", name: "Carson Ramirez", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.73, rom: 45, tempo: 2.9, attendance: 88, loadRec: "+2%", engagement: "High" },
  { id: "f44", name: "Brody James", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.68, rom: 42, tempo: 3.1, attendance: 84, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f45", name: "Tanner Watson", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.74, rom: 46, tempo: 2.8, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "f46", name: "Garrett Brooks", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.71, rom: 44, tempo: 2.9, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "f47", name: "Derek Kelly", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.66, rom: 41, tempo: 3.2, attendance: 82, loadRec: "-2%", engagement: "Low" },
  { id: "f48", name: "Parker Sanders", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.72, rom: 45, tempo: 2.9, attendance: 88, loadRec: "+2%", engagement: "High" },
  { id: "f49", name: "Trevor Price", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.69, rom: 43, tempo: 3.0, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "f50", name: "Spencer Long", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.67, rom: 42, tempo: 3.1, attendance: 83, loadRec: "Maintain", engagement: "Moderate" },
];

// Basketball Team (30 players - Boys)
const basketballAthletes: Athlete[] = [
  // Varsity Basketball (15)
  { id: "b1", name: "Jordan Lee", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.77, rom: 46, tempo: 2.7, attendance: 92, loadRec: "+5%", engagement: "High" },
  { id: "b2", name: "Tyler Brooks", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.88, rom: 49, tempo: 2.5, attendance: 85, loadRec: "+8%", engagement: "Moderate" },
  { id: "b3", name: "David Martinez", sport: "Basketball", group: "Center", level: "Varsity", avgVelocity: 1.69, rom: 43, tempo: 3.3, attendance: 83, loadRec: "-5%", engagement: "Low" },
  { id: "b4", name: "Liam Mitchell", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.74, rom: 45, tempo: 2.8, attendance: 86, loadRec: "Maintain", engagement: "Moderate" },
  { id: "b5", name: "Jacob Martin", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.77, rom: 46, tempo: 2.7, attendance: 92, loadRec: "+5%", engagement: "High" },
  { id: "b6", name: "Aiden Thompson", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.82, rom: 48, tempo: 2.6, attendance: 94, loadRec: "+6%", engagement: "High" },
  { id: "b7", name: "Elijah Williams", sport: "Basketball", group: "Center", level: "Varsity", avgVelocity: 1.70, rom: 44, tempo: 3.2, attendance: 85, loadRec: "-3%", engagement: "Moderate" },
  { id: "b8", name: "Matthew Brown", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.76, rom: 46, tempo: 2.7, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "b9", name: "Daniel Jones", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.80, rom: 47, tempo: 2.8, attendance: 89, loadRec: "+3%", engagement: "High" },
  { id: "b10", name: "Joshua Garcia", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.75, rom: 45, tempo: 2.9, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "b11", name: "Anthony Davis", sport: "Basketball", group: "Center", level: "Varsity", avgVelocity: 1.72, rom: 45, tempo: 3.1, attendance: 88, loadRec: "Maintain", engagement: "Moderate" },
  { id: "b12", name: "Christopher Miller", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.84, rom: 49, tempo: 2.5, attendance: 93, loadRec: "+7%", engagement: "High" },
  { id: "b13", name: "Ryan Wilson", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.78, rom: 47, tempo: 2.6, attendance: 90, loadRec: "+4%", engagement: "High" },
  { id: "b14", name: "Nicholas Anderson", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.81, rom: 48, tempo: 2.7, attendance: 92, loadRec: "+5%", engagement: "High" },
  { id: "b15", name: "Kevin Thomas", sport: "Basketball", group: "Center", level: "Varsity", avgVelocity: 1.68, rom: 42, tempo: 3.4, attendance: 81, loadRec: "-6%", engagement: "Low" },
  
  // JV Basketball (15)
  { id: "b16", name: "Brandon Taylor", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.70, rom: 44, tempo: 2.9, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "b17", name: "Marcus White", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.73, rom: 45, tempo: 2.8, attendance: 90, loadRec: "+4%", engagement: "High" },
  { id: "b18", name: "Tyler Harris", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.67, rom: 43, tempo: 3.0, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "b19", name: "Cameron Clark", sport: "Basketball", group: "Center", level: "JV", avgVelocity: 1.64, rom: 41, tempo: 3.3, attendance: 82, loadRec: "-4%", engagement: "Low" },
  { id: "b20", name: "Justin Lewis", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.72, rom: 45, tempo: 2.9, attendance: 88, loadRec: "+3%", engagement: "High" },
  { id: "b21", name: "Austin Walker", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.69, rom: 44, tempo: 3.0, attendance: 86, loadRec: "+2%", engagement: "Moderate" },
  { id: "b22", name: "Sean Robinson", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.71, rom: 44, tempo: 2.9, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "b23", name: "Kyle Young", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.68, rom: 43, tempo: 3.1, attendance: 84, loadRec: "+1%", engagement: "Moderate" },
  { id: "b24", name: "Trevor King", sport: "Basketball", group: "Center", level: "JV", avgVelocity: 1.65, rom: 42, tempo: 3.2, attendance: 83, loadRec: "-2%", engagement: "Low" },
  { id: "b25", name: "Cody Wright", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.70, rom: 44, tempo: 3.0, attendance: 86, loadRec: "+2%", engagement: "Moderate" },
  { id: "b26", name: "Derek Hill", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.66, rom: 42, tempo: 3.1, attendance: 83, loadRec: "Maintain", engagement: "Moderate" },
  { id: "b27", name: "Shane Scott", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.69, rom: 43, tempo: 3.0, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "b28", name: "Blake Green", sport: "Basketball", group: "Center", level: "JV", avgVelocity: 1.63, rom: 40, tempo: 3.4, attendance: 80, loadRec: "-5%", engagement: "Low" },
  { id: "b29", name: "Colton Hayes", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.68, rom: 43, tempo: 3.0, attendance: 84, loadRec: "+1%", engagement: "Moderate" },
  { id: "b30", name: "Grant Foster", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.66, rom: 41, tempo: 3.2, attendance: 81, loadRec: "-3%", engagement: "Low" },
];

// Soccer Team (46 players - Girls)
const soccerAthletes: Athlete[] = [
  // Varsity Soccer (23)
  { id: "s1", name: "Emma Smith", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.78, rom: 46, tempo: 2.6, attendance: 100, loadRec: "-10%", engagement: "High" },
  { id: "s2", name: "Olivia Thompson", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.73, rom: 44, tempo: 2.9, attendance: 98, loadRec: "Maintain", engagement: "High" },
  { id: "s3", name: "Charlotte Brown", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.76, rom: 46, tempo: 2.7, attendance: 95, loadRec: "Maintain", engagement: "High" },
  { id: "s4", name: "Emily Clark", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.83, rom: 49, tempo: 2.5, attendance: 97, loadRec: "+6%", engagement: "High" },
  { id: "s5", name: "Sophia Rodriguez", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.75, rom: 45, tempo: 2.8, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "s6", name: "Amelia Johnson", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.80, rom: 48, tempo: 2.6, attendance: 96, loadRec: "+5%", engagement: "High" },
  { id: "s7", name: "Isabella Martinez", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.82, rom: 48, tempo: 2.5, attendance: 98, loadRec: "+7%", engagement: "High" },
  { id: "s8", name: "Mia Anderson", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.74, rom: 45, tempo: 2.8, attendance: 93, loadRec: "+2%", engagement: "High" },
  { id: "s9", name: "Harper Taylor", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.77, rom: 47, tempo: 2.7, attendance: 95, loadRec: "+4%", engagement: "High" },
  { id: "s10", name: "Evelyn Moore", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.79, rom: 47, tempo: 2.6, attendance: 96, loadRec: "+5%", engagement: "High" },
  { id: "s11", name: "Abigail Jackson", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.72, rom: 44, tempo: 2.9, attendance: 92, loadRec: "+1%", engagement: "High" },
  { id: "s12", name: "Ella White", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.78, rom: 47, tempo: 2.7, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "s13", name: "Scarlett Harris", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.81, rom: 48, tempo: 2.5, attendance: 97, loadRec: "+6%", engagement: "High" },
  { id: "s14", name: "Grace Martin", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.71, rom: 43, tempo: 3.0, attendance: 91, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s15", name: "Chloe Thompson", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.75, rom: 46, tempo: 2.8, attendance: 93, loadRec: "+2%", engagement: "High" },
  { id: "s16", name: "Victoria Garcia", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.80, rom: 47, tempo: 2.6, attendance: 95, loadRec: "+4%", engagement: "High" },
  { id: "s17", name: "Penelope Martinez", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.73, rom: 45, tempo: 2.9, attendance: 92, loadRec: "+1%", engagement: "High" },
  { id: "s18", name: "Layla Robinson", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.76, rom: 46, tempo: 2.7, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "s19", name: "Riley Clark", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.79, rom: 47, tempo: 2.6, attendance: 96, loadRec: "+5%", engagement: "High" },
  { id: "s20", name: "Zoey Lewis", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.70, rom: 43, tempo: 3.0, attendance: 90, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s21", name: "Nora Lee", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.77, rom: 46, tempo: 2.7, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "s22", name: "Lily Walker", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.78, rom: 47, tempo: 2.6, attendance: 95, loadRec: "+4%", engagement: "High" },
  { id: "s23", name: "Hannah Hall", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.72, rom: 44, tempo: 2.9, attendance: 91, loadRec: "+1%", engagement: "High" },
  
  // JV Soccer (23)
  { id: "s24", name: "Maya Patel", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.62, rom: 40, tempo: 3.2, attendance: 92, loadRec: "+2%", engagement: "Moderate" },
  { id: "s25", name: "Madison King", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.65, rom: 42, tempo: 3.0, attendance: 89, loadRec: "+2%", engagement: "Moderate" },
  { id: "s26", name: "Aria Wright", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.68, rom: 43, tempo: 2.9, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "s27", name: "Luna Scott", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.63, rom: 41, tempo: 3.1, attendance: 87, loadRec: "+1%", engagement: "Moderate" },
  { id: "s28", name: "Stella Green", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.66, rom: 43, tempo: 3.0, attendance: 88, loadRec: "+2%", engagement: "Moderate" },
  { id: "s29", name: "Hazel Adams", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.69, rom: 44, tempo: 2.9, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "s30", name: "Violet Baker", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.61, rom: 40, tempo: 3.2, attendance: 86, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s31", name: "Aurora Nelson", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.67, rom: 43, tempo: 3.0, attendance: 89, loadRec: "+2%", engagement: "Moderate" },
  { id: "s32", name: "Savannah Carter", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.71, rom: 44, tempo: 2.8, attendance: 92, loadRec: "+5%", engagement: "High" },
  { id: "s33", name: "Brooklyn Mitchell", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.62, rom: 41, tempo: 3.1, attendance: 87, loadRec: "+1%", engagement: "Moderate" },
  { id: "s34", name: "Bella Perez", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.65, rom: 42, tempo: 3.0, attendance: 88, loadRec: "+2%", engagement: "Moderate" },
  { id: "s35", name: "Claire Roberts", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.68, rom: 43, tempo: 2.9, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "s36", name: "Skylar Turner", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.60, rom: 40, tempo: 3.2, attendance: 85, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s37", name: "Lucy Phillips", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.66, rom: 42, tempo: 3.0, attendance: 89, loadRec: "+2%", engagement: "Moderate" },
  { id: "s38", name: "Ellie Campbell", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.69, rom: 44, tempo: 2.9, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "s39", name: "Paisley Parker", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.61, rom: 41, tempo: 3.1, attendance: 86, loadRec: "+1%", engagement: "Moderate" },
  { id: "s40", name: "Audrey Evans", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.64, rom: 42, tempo: 3.0, attendance: 88, loadRec: "+1%", engagement: "Moderate" },
  { id: "s41", name: "Leah Edwards", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.67, rom: 43, tempo: 2.9, attendance: 89, loadRec: "+3%", engagement: "Moderate" },
  { id: "s42", name: "Anna Collins", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.59, rom: 39, tempo: 3.3, attendance: 84, loadRec: "-1%", engagement: "Low" },
  { id: "s43", name: "Caroline Stewart", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.63, rom: 41, tempo: 3.1, attendance: 87, loadRec: "+1%", engagement: "Moderate" },
  { id: "s44", name: "Sarah Morris", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.66, rom: 43, tempo: 3.0, attendance: 88, loadRec: "+2%", engagement: "Moderate" },
  { id: "s45", name: "Vivian Ross", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.62, rom: 41, tempo: 3.1, attendance: 86, loadRec: "+1%", engagement: "Moderate" },
  { id: "s46", name: "Genesis Hughes", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.64, rom: 42, tempo: 3.0, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
];

// Volleyball Team (24 players - Girls)
const volleyballAthletes: Athlete[] = [
  // Varsity Volleyball (12)
  { id: "v1", name: "Sofia Rodriguez", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.71, rom: 44, tempo: 2.7, attendance: 97, loadRec: "Maintain", engagement: "High" },
  { id: "v2", name: "Isabella Chen", sport: "Volleyball", group: "Hitter", level: "Varsity", avgVelocity: 1.82, rom: 47, tempo: 2.6, attendance: 96, loadRec: "+4%", engagement: "High" },
  { id: "v3", name: "Addison Flores", sport: "Volleyball", group: "Hitter", level: "Varsity", avgVelocity: 1.84, rom: 49, tempo: 2.5, attendance: 98, loadRec: "+6%", engagement: "High" },
  { id: "v4", name: "Natalie Rivera", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.73, rom: 45, tempo: 2.7, attendance: 95, loadRec: "+2%", engagement: "High" },
  { id: "v5", name: "Maya Hughes", sport: "Volleyball", group: "Hitter", level: "Varsity", avgVelocity: 1.79, rom: 47, tempo: 2.6, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "v6", name: "Alexa Coleman", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.70, rom: 44, tempo: 2.8, attendance: 92, loadRec: "Maintain", engagement: "High" },
  { id: "v7", name: "Aubrey Watson", sport: "Volleyball", group: "Hitter", level: "Varsity", avgVelocity: 1.81, rom: 48, tempo: 2.6, attendance: 96, loadRec: "+5%", engagement: "High" },
  { id: "v8", name: "Kennedy Brooks", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.72, rom: 44, tempo: 2.7, attendance: 93, loadRec: "+1%", engagement: "High" },
  { id: "v9", name: "Madelyn Reed", sport: "Volleyball", group: "Hitter", level: "Varsity", avgVelocity: 1.83, rom: 48, tempo: 2.5, attendance: 97, loadRec: "+6%", engagement: "High" },
  { id: "v10", name: "Piper Morgan", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.74, rom: 45, tempo: 2.7, attendance: 94, loadRec: "+2%", engagement: "High" },
  { id: "v11", name: "Eliana Ross", sport: "Volleyball", group: "Hitter", level: "Varsity", avgVelocity: 1.80, rom: 48, tempo: 2.6, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "v12", name: "Camila Bennett", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.75, rom: 45, tempo: 2.8, attendance: 93, loadRec: "Maintain", engagement: "High" },
  
  // JV Volleyball (12)
  { id: "v13", name: "Amelia Moore", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.63, rom: 40, tempo: 3.0, attendance: 90, loadRec: "+2%", engagement: "Moderate" },
  { id: "v14", name: "Harper Jackson", sport: "Volleyball", group: "Hitter", level: "JV", avgVelocity: 1.72, rom: 44, tempo: 2.8, attendance: 87, loadRec: "+4%", engagement: "Moderate" },
  { id: "v15", name: "Elena Bailey", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.65, rom: 42, tempo: 2.9, attendance: 88, loadRec: "+2%", engagement: "Moderate" },
  { id: "v16", name: "Naomi Cooper", sport: "Volleyball", group: "Hitter", level: "JV", avgVelocity: 1.68, rom: 43, tempo: 2.8, attendance: 89, loadRec: "+3%", engagement: "High" },
  { id: "v17", name: "Mackenzie Richardson", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.62, rom: 41, tempo: 3.0, attendance: 86, loadRec: "+1%", engagement: "Moderate" },
  { id: "v18", name: "Ruby Cox", sport: "Volleyball", group: "Hitter", level: "JV", avgVelocity: 1.70, rom: 44, tempo: 2.8, attendance: 90, loadRec: "+4%", engagement: "High" },
  { id: "v19", name: "Serenity Howard", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.64, rom: 41, tempo: 2.9, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "v20", name: "Quinn Ward", sport: "Volleyball", group: "Hitter", level: "JV", avgVelocity: 1.69, rom: 43, tempo: 2.8, attendance: 88, loadRec: "+3%", engagement: "Moderate" },
  { id: "v21", name: "Jasmine Torres", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.61, rom: 40, tempo: 3.1, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "v22", name: "Alana Peterson", sport: "Volleyball", group: "Hitter", level: "JV", avgVelocity: 1.67, rom: 42, tempo: 2.9, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "v23", name: "Emery Gray", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.60, rom: 40, tempo: 3.0, attendance: 84, loadRec: "Maintain", engagement: "Moderate" },
  { id: "v24", name: "Willow Ramirez", sport: "Volleyball", group: "Hitter", level: "JV", avgVelocity: 1.66, rom: 42, tempo: 2.9, attendance: 86, loadRec: "+2%", engagement: "Moderate" },
];

export const mockAthletes: Athlete[] = [
  ...footballAthletes,
  ...basketballAthletes,
  ...soccerAthletes,
  ...volleyballAthletes,
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
  activeAthletes: mockAthletes.length,
  avgVelocity: 1.73,
  avgROM: 45,
  avgTempo: 2.8,
  loadRecIndex: "+3%",
};

export const weeklyStats = {
  totalSessions: 285,
  avgTeamLoad: 89,
  topPerformer: "Emma Smith",
  lowestAttendance: 80,
};
