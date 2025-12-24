export interface Athlete {
  id: string;
  name: string;
  sport: string;
  group: string;
  level: string;
  avgVelocity: number;
  attendance: number;
  loadRec: string;
  engagement: "High" | "Moderate" | "Low";
}

export interface Rep {
  repNumber: number;
  velocity: number;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  weightUnit: "lbs" | "kg";
  avgVelocity: number;
  peakVelocity: number;
  targetVelocityMin: number;
  targetVelocityMax: number;
  repData: Rep[];
}

export interface Session {
  id: string;
  date: string;
  exercises: Exercise[];
  notes?: string;
}

export interface WorkoutTemplateExercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
  weightUnit: "lbs" | "kg";
  targetVelocityMin: number;
  targetVelocityMax: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: WorkoutTemplateExercise[];
}

export interface PerformanceData {
  date: string;
  velocity: number;
}

// Football Team (50 players - Boys)
const footballAthletes: Athlete[] = [
  // Varsity Football Offense (15)
  { id: "f1", name: "Marcus Johnson", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.92, attendance: 94, loadRec: "+5%", engagement: "High" },
  { id: "f2", name: "Tyler Brooks", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.88, attendance: 85, loadRec: "+8%", engagement: "Moderate" },
  { id: "f3", name: "Ethan Parker", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.87, attendance: 93, loadRec: "+4%", engagement: "High" },
  { id: "f4", name: "Jackson Rivera", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.85, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "f5", name: "Mason Wright", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.83, attendance: 88, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f6", name: "Logan Foster", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.90, attendance: 96, loadRec: "+6%", engagement: "High" },
  { id: "f7", name: "Carter Hayes", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.86, attendance: 89, loadRec: "+2%", engagement: "Moderate" },
  { id: "f8", name: "Dylan Cooper", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.84, attendance: 92, loadRec: "+4%", engagement: "High" },
  { id: "f9", name: "Austin Morgan", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.81, attendance: 87, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f10", name: "Caleb Bennett", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.89, attendance: 95, loadRec: "+5%", engagement: "High" },
  { id: "f11", name: "Ryan Coleman", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.82, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "f12", name: "Blake Hughes", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.87, attendance: 93, loadRec: "+4%", engagement: "High" },
  { id: "f13", name: "Hunter Price", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.85, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "f14", name: "Brandon Reed", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.80, attendance: 86, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f15", name: "Justin Powell", sport: "Football", group: "Offense", level: "Varsity", avgVelocity: 1.88, attendance: 94, loadRec: "+5%", engagement: "High" },
  
  // Varsity Football Defense (15)
  { id: "f16", name: "Noah Davis", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.81, attendance: 90, loadRec: "+2%", engagement: "High" },
  { id: "f17", name: "James Wilson", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.79, attendance: 87, loadRec: "+6%", engagement: "Moderate" },
  { id: "f18", name: "Alexander King", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.84, attendance: 92, loadRec: "+4%", engagement: "High" },
  { id: "f19", name: "Zachary Scott", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.86, attendance: 94, loadRec: "+5%", engagement: "High" },
  { id: "f20", name: "Gabriel Adams", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.83, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "f21", name: "Isaac Turner", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.78, attendance: 88, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f22", name: "Owen Phillips", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.85, attendance: 93, loadRec: "+4%", engagement: "High" },
  { id: "f23", name: "Lucas Campbell", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.82, attendance: 90, loadRec: "+2%", engagement: "High" },
  { id: "f24", name: "Henry Mitchell", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.80, attendance: 89, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f25", name: "Samuel Roberts", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.87, attendance: 95, loadRec: "+6%", engagement: "High" },
  { id: "f26", name: "Nathan Carter", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.84, attendance: 92, loadRec: "+4%", engagement: "High" },
  { id: "f27", name: "Andrew Evans", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.81, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "f28", name: "Evan Bailey", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.79, attendance: 87, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f29", name: "Christian Wood", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.83, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "f30", name: "Connor Brooks", sport: "Football", group: "Defense", level: "Varsity", avgVelocity: 1.88, attendance: 94, loadRec: "+5%", engagement: "High" },
  
  // JV Football (20)
  { id: "f31", name: "Chris Anderson", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.75, attendance: 89, loadRec: "Maintain", engagement: "High" },
  { id: "f32", name: "Jordan Murphy", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.72, attendance: 88, loadRec: "+2%", engagement: "Moderate" },
  { id: "f33", name: "Cameron Rivera", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.70, attendance: 86, loadRec: "+1%", engagement: "Moderate" },
  { id: "f34", name: "Wyatt Cooper", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.74, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "f35", name: "Gavin Richardson", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.68, attendance: 84, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f36", name: "Tristan Cox", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.76, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "f37", name: "Dominic Howard", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.71, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "f38", name: "Adrian Ward", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.73, attendance: 89, loadRec: "+2%", engagement: "High" },
  { id: "f39", name: "Miles Torres", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.69, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "f40", name: "Brock Jenkins", sport: "Football", group: "Offense", level: "JV", avgVelocity: 1.67, attendance: 85, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f41", name: "Ian Peterson", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.75, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "f42", name: "Colin Gray", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.70, attendance: 86, loadRec: "+1%", engagement: "Moderate" },
  { id: "f43", name: "Carson Ramirez", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.73, attendance: 88, loadRec: "+2%", engagement: "High" },
  { id: "f44", name: "Brody James", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.68, attendance: 84, loadRec: "Maintain", engagement: "Moderate" },
  { id: "f45", name: "Tanner Watson", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.74, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "f46", name: "Garrett Brooks", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.71, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "f47", name: "Derek Kelly", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.66, attendance: 82, loadRec: "-2%", engagement: "Low" },
  { id: "f48", name: "Parker Sanders", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.72, attendance: 88, loadRec: "+2%", engagement: "High" },
  { id: "f49", name: "Trevor Price", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.69, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "f50", name: "Spencer Long", sport: "Football", group: "Defense", level: "JV", avgVelocity: 1.67, attendance: 83, loadRec: "Maintain", engagement: "Moderate" },
];

// Basketball Team (30 players - Boys)
const basketballAthletes: Athlete[] = [
  // Varsity Basketball (15)
  { id: "b1", name: "Jordan Lee", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.77, attendance: 92, loadRec: "+5%", engagement: "High" },
  { id: "b2", name: "Tyler Brooks", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.88, attendance: 85, loadRec: "+8%", engagement: "Moderate" },
  { id: "b3", name: "David Martinez", sport: "Basketball", group: "Center", level: "Varsity", avgVelocity: 1.69, attendance: 83, loadRec: "-5%", engagement: "Low" },
  { id: "b4", name: "Liam Mitchell", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.74, attendance: 86, loadRec: "Maintain", engagement: "Moderate" },
  { id: "b5", name: "Jacob Martin", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.77, attendance: 92, loadRec: "+5%", engagement: "High" },
  { id: "b6", name: "Aiden Thompson", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.82, attendance: 94, loadRec: "+6%", engagement: "High" },
  { id: "b7", name: "Elijah Williams", sport: "Basketball", group: "Center", level: "Varsity", avgVelocity: 1.70, attendance: 85, loadRec: "-3%", engagement: "Moderate" },
  { id: "b8", name: "Matthew Brown", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.76, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "b9", name: "Daniel Jones", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.80, attendance: 89, loadRec: "+3%", engagement: "High" },
  { id: "b10", name: "Joshua Garcia", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.75, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "b11", name: "Anthony Davis", sport: "Basketball", group: "Center", level: "Varsity", avgVelocity: 1.72, attendance: 88, loadRec: "Maintain", engagement: "Moderate" },
  { id: "b12", name: "Christopher Miller", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.84, attendance: 93, loadRec: "+7%", engagement: "High" },
  { id: "b13", name: "Ryan Wilson", sport: "Basketball", group: "Guard", level: "Varsity", avgVelocity: 1.78, attendance: 90, loadRec: "+4%", engagement: "High" },
  { id: "b14", name: "Nicholas Anderson", sport: "Basketball", group: "Forward", level: "Varsity", avgVelocity: 1.81, attendance: 92, loadRec: "+5%", engagement: "High" },
  { id: "b15", name: "Kevin Thomas", sport: "Basketball", group: "Center", level: "Varsity", avgVelocity: 1.68, attendance: 81, loadRec: "-6%", engagement: "Low" },
  
  // JV Basketball (15)
  { id: "b16", name: "Brandon Taylor", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.70, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "b17", name: "Marcus White", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.73, attendance: 90, loadRec: "+4%", engagement: "High" },
  { id: "b18", name: "Tyler Harris", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.67, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "b19", name: "Cameron Clark", sport: "Basketball", group: "Center", level: "JV", avgVelocity: 1.64, attendance: 82, loadRec: "-4%", engagement: "Low" },
  { id: "b20", name: "Justin Lewis", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.72, attendance: 88, loadRec: "+3%", engagement: "High" },
  { id: "b21", name: "Austin Walker", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.69, attendance: 86, loadRec: "+2%", engagement: "Moderate" },
  { id: "b22", name: "Sean Robinson", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.71, attendance: 87, loadRec: "+2%", engagement: "Moderate" },
  { id: "b23", name: "Kyle Young", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.68, attendance: 84, loadRec: "+1%", engagement: "Moderate" },
  { id: "b24", name: "Trevor King", sport: "Basketball", group: "Center", level: "JV", avgVelocity: 1.65, attendance: 83, loadRec: "-2%", engagement: "Low" },
  { id: "b25", name: "Cody Wright", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.70, attendance: 86, loadRec: "+2%", engagement: "Moderate" },
  { id: "b26", name: "Derek Hill", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.66, attendance: 83, loadRec: "Maintain", engagement: "Moderate" },
  { id: "b27", name: "Shane Scott", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.69, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "b28", name: "Blake Green", sport: "Basketball", group: "Center", level: "JV", avgVelocity: 1.63, attendance: 80, loadRec: "-5%", engagement: "Low" },
  { id: "b29", name: "Colton Hayes", sport: "Basketball", group: "Guard", level: "JV", avgVelocity: 1.68, attendance: 84, loadRec: "+1%", engagement: "Moderate" },
  { id: "b30", name: "Grant Foster", sport: "Basketball", group: "Forward", level: "JV", avgVelocity: 1.66, attendance: 81, loadRec: "-3%", engagement: "Low" },
];

// Soccer Team (46 players - Girls)
const soccerAthletes: Athlete[] = [
  // Varsity Soccer (23)
  { id: "s1", name: "Emma Smith", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.78, attendance: 100, loadRec: "-10%", engagement: "High" },
  { id: "s2", name: "Olivia Thompson", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.73, attendance: 98, loadRec: "Maintain", engagement: "High" },
  { id: "s3", name: "Charlotte Brown", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.76, attendance: 95, loadRec: "Maintain", engagement: "High" },
  { id: "s4", name: "Emily Clark", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.83, attendance: 97, loadRec: "+6%", engagement: "High" },
  { id: "s5", name: "Sophia Rodriguez", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.75, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "s6", name: "Amelia Johnson", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.80, attendance: 96, loadRec: "+5%", engagement: "High" },
  { id: "s7", name: "Isabella Martinez", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.82, attendance: 98, loadRec: "+7%", engagement: "High" },
  { id: "s8", name: "Mia Anderson", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.74, attendance: 93, loadRec: "+2%", engagement: "High" },
  { id: "s9", name: "Harper Taylor", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.77, attendance: 95, loadRec: "+4%", engagement: "High" },
  { id: "s10", name: "Evelyn Moore", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.79, attendance: 96, loadRec: "+5%", engagement: "High" },
  { id: "s11", name: "Abigail Jackson", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.72, attendance: 92, loadRec: "+1%", engagement: "High" },
  { id: "s12", name: "Ella White", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.78, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "s13", name: "Scarlett Harris", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.81, attendance: 97, loadRec: "+6%", engagement: "High" },
  { id: "s14", name: "Grace Martin", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.71, attendance: 91, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s15", name: "Chloe Thompson", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.75, attendance: 93, loadRec: "+2%", engagement: "High" },
  { id: "s16", name: "Victoria Garcia", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.80, attendance: 95, loadRec: "+5%", engagement: "High" },
  { id: "s17", name: "Penelope Robinson", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.73, attendance: 92, loadRec: "+1%", engagement: "High" },
  { id: "s18", name: "Riley Clark", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.76, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "s19", name: "Zoey Lewis", sport: "Soccer", group: "Forward", level: "Varsity", avgVelocity: 1.79, attendance: 96, loadRec: "+4%", engagement: "High" },
  { id: "s20", name: "Nora Walker", sport: "Soccer", group: "Defense", level: "Varsity", avgVelocity: 1.70, attendance: 90, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s21", name: "Lily Hall", sport: "Soccer", group: "Midfielder", level: "Varsity", avgVelocity: 1.77, attendance: 93, loadRec: "+2%", engagement: "High" },
  { id: "s22", name: "Eleanor Young", sport: "Soccer", group: "Goalkeeper", level: "Varsity", avgVelocity: 1.65, attendance: 98, loadRec: "Maintain", engagement: "High" },
  { id: "s23", name: "Hannah King", sport: "Soccer", group: "Goalkeeper", level: "Varsity", avgVelocity: 1.63, attendance: 95, loadRec: "Maintain", engagement: "High" },
  
  // JV Soccer (23)
  { id: "s24", name: "Addison Wright", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.70, attendance: 92, loadRec: "+3%", engagement: "High" },
  { id: "s25", name: "Aubrey Scott", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.66, attendance: 89, loadRec: "+1%", engagement: "Moderate" },
  { id: "s26", name: "Savannah Green", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.69, attendance: 91, loadRec: "+2%", engagement: "High" },
  { id: "s27", name: "Brooklyn Adams", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.72, attendance: 93, loadRec: "+4%", engagement: "High" },
  { id: "s28", name: "Leah Nelson", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.65, attendance: 88, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s29", name: "Stella Hill", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.68, attendance: 90, loadRec: "+2%", engagement: "High" },
  { id: "s30", name: "Hazel Moore", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.71, attendance: 92, loadRec: "+3%", engagement: "High" },
  { id: "s31", name: "Violet Taylor", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.64, attendance: 87, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s32", name: "Aurora Anderson", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.67, attendance: 89, loadRec: "+1%", engagement: "Moderate" },
  { id: "s33", name: "Luna Thomas", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.73, attendance: 94, loadRec: "+5%", engagement: "High" },
  { id: "s34", name: "Willow Jackson", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.63, attendance: 86, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s35", name: "Emilia White", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.66, attendance: 88, loadRec: "+1%", engagement: "Moderate" },
  { id: "s36", name: "Paisley Harris", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.70, attendance: 91, loadRec: "+2%", engagement: "High" },
  { id: "s37", name: "Maya Martin", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.62, attendance: 85, loadRec: "-1%", engagement: "Moderate" },
  { id: "s38", name: "Ellie Garcia", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.65, attendance: 87, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s39", name: "Bella Robinson", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.69, attendance: 90, loadRec: "+2%", engagement: "High" },
  { id: "s40", name: "Skylar Clark", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.61, attendance: 84, loadRec: "-2%", engagement: "Low" },
  { id: "s41", name: "Claire Lewis", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.64, attendance: 86, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s42", name: "Lucy Walker", sport: "Soccer", group: "Forward", level: "JV", avgVelocity: 1.68, attendance: 89, loadRec: "+1%", engagement: "Moderate" },
  { id: "s43", name: "Anna Hall", sport: "Soccer", group: "Defense", level: "JV", avgVelocity: 1.60, attendance: 83, loadRec: "-3%", engagement: "Low" },
  { id: "s44", name: "Caroline Young", sport: "Soccer", group: "Midfielder", level: "JV", avgVelocity: 1.63, attendance: 85, loadRec: "Maintain", engagement: "Moderate" },
  { id: "s45", name: "Kennedy King", sport: "Soccer", group: "Goalkeeper", level: "JV", avgVelocity: 1.58, attendance: 90, loadRec: "Maintain", engagement: "High" },
  { id: "s46", name: "Samantha Wright", sport: "Soccer", group: "Goalkeeper", level: "JV", avgVelocity: 1.56, attendance: 88, loadRec: "Maintain", engagement: "Moderate" },
];

// Volleyball Team (30 players - Girls)
const volleyballAthletes: Athlete[] = [
  // Varsity Volleyball (15)
  { id: "v1", name: "Madison Lee", sport: "Volleyball", group: "Outside Hitter", level: "Varsity", avgVelocity: 1.80, attendance: 96, loadRec: "+5%", engagement: "High" },
  { id: "v2", name: "Taylor Johnson", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.75, attendance: 94, loadRec: "+3%", engagement: "High" },
  { id: "v3", name: "Morgan Williams", sport: "Volleyball", group: "Middle Blocker", level: "Varsity", avgVelocity: 1.82, attendance: 97, loadRec: "+6%", engagement: "High" },
  { id: "v4", name: "Jordan Brown", sport: "Volleyball", group: "Outside Hitter", level: "Varsity", avgVelocity: 1.78, attendance: 93, loadRec: "+4%", engagement: "High" },
  { id: "v5", name: "Casey Davis", sport: "Volleyball", group: "Libero", level: "Varsity", avgVelocity: 1.70, attendance: 98, loadRec: "Maintain", engagement: "High" },
  { id: "v6", name: "Alex Martinez", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.73, attendance: 92, loadRec: "+2%", engagement: "High" },
  { id: "v7", name: "Jamie Anderson", sport: "Volleyball", group: "Middle Blocker", level: "Varsity", avgVelocity: 1.81, attendance: 95, loadRec: "+5%", engagement: "High" },
  { id: "v8", name: "Drew Taylor", sport: "Volleyball", group: "Outside Hitter", level: "Varsity", avgVelocity: 1.77, attendance: 91, loadRec: "+3%", engagement: "High" },
  { id: "v9", name: "Avery Thomas", sport: "Volleyball", group: "Opposite", level: "Varsity", avgVelocity: 1.79, attendance: 94, loadRec: "+4%", engagement: "High" },
  { id: "v10", name: "Quinn Moore", sport: "Volleyball", group: "Libero", level: "Varsity", avgVelocity: 1.68, attendance: 96, loadRec: "Maintain", engagement: "High" },
  { id: "v11", name: "Riley Jackson", sport: "Volleyball", group: "Middle Blocker", level: "Varsity", avgVelocity: 1.83, attendance: 93, loadRec: "+5%", engagement: "High" },
  { id: "v12", name: "Cameron White", sport: "Volleyball", group: "Setter", level: "Varsity", avgVelocity: 1.72, attendance: 90, loadRec: "+1%", engagement: "Moderate" },
  { id: "v13", name: "Peyton Harris", sport: "Volleyball", group: "Outside Hitter", level: "Varsity", avgVelocity: 1.76, attendance: 92, loadRec: "+3%", engagement: "High" },
  { id: "v14", name: "Hayden Martin", sport: "Volleyball", group: "Opposite", level: "Varsity", avgVelocity: 1.78, attendance: 91, loadRec: "+4%", engagement: "High" },
  { id: "v15", name: "Reese Garcia", sport: "Volleyball", group: "Middle Blocker", level: "Varsity", avgVelocity: 1.80, attendance: 95, loadRec: "+5%", engagement: "High" },
  
  // JV Volleyball (15)
  { id: "v16", name: "Parker Robinson", sport: "Volleyball", group: "Outside Hitter", level: "JV", avgVelocity: 1.68, attendance: 89, loadRec: "+2%", engagement: "Moderate" },
  { id: "v17", name: "Dakota Clark", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.64, attendance: 87, loadRec: "+1%", engagement: "Moderate" },
  { id: "v18", name: "Skyler Lewis", sport: "Volleyball", group: "Middle Blocker", level: "JV", avgVelocity: 1.70, attendance: 90, loadRec: "+3%", engagement: "High" },
  { id: "v19", name: "Finley Walker", sport: "Volleyball", group: "Outside Hitter", level: "JV", avgVelocity: 1.66, attendance: 86, loadRec: "Maintain", engagement: "Moderate" },
  { id: "v20", name: "Emerson Hall", sport: "Volleyball", group: "Libero", level: "JV", avgVelocity: 1.60, attendance: 91, loadRec: "Maintain", engagement: "High" },
  { id: "v21", name: "Phoenix Young", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.62, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "v22", name: "Sage Allen", sport: "Volleyball", group: "Middle Blocker", level: "JV", avgVelocity: 1.69, attendance: 88, loadRec: "+2%", engagement: "Moderate" },
  { id: "v23", name: "River King", sport: "Volleyball", group: "Outside Hitter", level: "JV", avgVelocity: 1.65, attendance: 84, loadRec: "Maintain", engagement: "Moderate" },
  { id: "v24", name: "Blake Wright", sport: "Volleyball", group: "Opposite", level: "JV", avgVelocity: 1.67, attendance: 87, loadRec: "+1%", engagement: "Moderate" },
  { id: "v25", name: "Rowan Scott", sport: "Volleyball", group: "Libero", level: "JV", avgVelocity: 1.58, attendance: 89, loadRec: "Maintain", engagement: "High" },
  { id: "v26", name: "Charlie Green", sport: "Volleyball", group: "Middle Blocker", level: "JV", avgVelocity: 1.71, attendance: 86, loadRec: "+2%", engagement: "Moderate" },
  { id: "v27", name: "Eden Adams", sport: "Volleyball", group: "Setter", level: "JV", avgVelocity: 1.61, attendance: 83, loadRec: "Maintain", engagement: "Moderate" },
  { id: "v28", name: "Harley Nelson", sport: "Volleyball", group: "Outside Hitter", level: "JV", avgVelocity: 1.64, attendance: 85, loadRec: "+1%", engagement: "Moderate" },
  { id: "v29", name: "Rory Hill", sport: "Volleyball", group: "Opposite", level: "JV", avgVelocity: 1.66, attendance: 84, loadRec: "Maintain", engagement: "Moderate" },
  { id: "v30", name: "Jesse Moore", sport: "Volleyball", group: "Middle Blocker", level: "JV", avgVelocity: 1.68, attendance: 82, loadRec: "-1%", engagement: "Low" },
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
    });
  }

  return data;
};

const exerciseLibrary = [
  "Back Squat", "Front Squat", "Romanian Deadlift", "Bench Press", 
  "Overhead Press", "Power Clean", "Hang Clean", "Box Jump",
  "Trap Bar Deadlift", "Bulgarian Split Squat", "Single Leg RDL",
  "Incline Bench Press", "Push Press", "Pull-ups", "Barbell Row"
];

export const generateSessionLogs = (athleteId: string): Session[] => {
  const athlete = mockAthletes.find((a) => a.id === athleteId);
  if (!athlete) return [];

  const sessions: Session[] = [];
  for (let i = 0; i < 10; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i * 3);
    
    const numExercises = Math.floor(Math.random() * 3) + 3; // 3-5 exercises
    const exercises: Exercise[] = [];
    
    for (let j = 0; j < numExercises; j++) {
      const exerciseName = exerciseLibrary[Math.floor(Math.random() * exerciseLibrary.length)];
      const weight = Math.floor(Math.random() * 150) + 50; // 50-200 lbs
      const sets = Math.floor(Math.random() * 3) + 3; // 3-5 sets
      const reps = Math.floor(Math.random() * 6) + 5; // 5-10 reps
      const totalReps = sets * reps;
      
      // Generate target velocity range
      const targetVelocityMin = parseFloat((Math.random() * 0.3 + 1.2).toFixed(2)); // 1.2-1.5
      const targetVelocityMax = parseFloat((targetVelocityMin + 0.3).toFixed(2)); // +0.3 range
      
      // Generate individual rep data with some variance
      const repData: Rep[] = [];
      let totalVelocity = 0;
      let maxVelocity = 0;
      
      for (let r = 1; r <= totalReps; r++) {
        // Generate velocity with some in target and some out
        const inTarget = Math.random() > 0.3; // 70% chance in target
        let velocity: number;
        
        if (inTarget) {
          velocity = parseFloat((targetVelocityMin + Math.random() * (targetVelocityMax - targetVelocityMin)).toFixed(2));
        } else {
          // Out of target - either too slow or too fast
          if (Math.random() > 0.5) {
            velocity = parseFloat((targetVelocityMin - Math.random() * 0.3).toFixed(2)); // Too slow
          } else {
            velocity = parseFloat((targetVelocityMax + Math.random() * 0.3).toFixed(2)); // Too fast
          }
        }
        
        repData.push({ repNumber: r, velocity });
        totalVelocity += velocity;
        maxVelocity = Math.max(maxVelocity, velocity);
      }
      
      exercises.push({
        id: `ex-${i}-${j}`,
        name: exerciseName,
        sets,
        reps,
        weight,
        weightUnit: "lbs",
        avgVelocity: parseFloat((totalVelocity / totalReps).toFixed(2)),
        peakVelocity: maxVelocity,
        targetVelocityMin,
        targetVelocityMax,
        repData,
      });
    }
    
    sessions.push({
      id: `session-${athleteId}-${i}`,
      date: date.toISOString().split("T")[0],
      exercises,
      notes: i % 3 === 0 ? "Good session, athlete felt strong" : undefined
    });
  }
  return sessions;
};

export const workoutTemplates: WorkoutTemplate[] = [
  {
    id: "template-1",
    name: "Lower Body Power",
    exercises: [
      { name: "Back Squat", sets: 4, reps: 5, weight: 185, weightUnit: "lbs", targetVelocityMin: 1.0, targetVelocityMax: 1.5 },
      { name: "Romanian Deadlift", sets: 3, reps: 8, weight: 135, weightUnit: "lbs", targetVelocityMin: 0.8, targetVelocityMax: 1.2 },
      { name: "Box Jump", sets: 4, reps: 6, weight: 0, weightUnit: "lbs", targetVelocityMin: 2.0, targetVelocityMax: 2.5 }
    ]
  },
  {
    id: "template-2",
    name: "Upper Body Strength",
    exercises: [
      { name: "Bench Press", sets: 4, reps: 6, weight: 155, weightUnit: "lbs", targetVelocityMin: 0.8, targetVelocityMax: 1.3 },
      { name: "Overhead Press", sets: 3, reps: 8, weight: 95, weightUnit: "lbs", targetVelocityMin: 0.7, targetVelocityMax: 1.2 },
      { name: "Barbell Row", sets: 3, reps: 8, weight: 115, weightUnit: "lbs", targetVelocityMin: 0.9, targetVelocityMax: 1.4 }
    ]
  },
  {
    id: "template-3",
    name: "Olympic Lifting",
    exercises: [
      { name: "Power Clean", sets: 5, reps: 3, weight: 135, weightUnit: "lbs", targetVelocityMin: 1.5, targetVelocityMax: 2.0 },
      { name: "Front Squat", sets: 4, reps: 5, weight: 155, weightUnit: "lbs", targetVelocityMin: 1.0, targetVelocityMax: 1.5 },
      { name: "Push Press", sets: 3, reps: 6, weight: 115, weightUnit: "lbs", targetVelocityMin: 1.2, targetVelocityMax: 1.7 }
    ]
  }
];

export const teamStats = {
  activeAthletes: mockAthletes.length,
  avgAttendance: Math.round(mockAthletes.reduce((sum, a) => sum + a.attendance, 0) / mockAthletes.length),
  totalTeams: 8,
};

export const weeklyStats = {
  totalSessions: 285,
  avgTeamLoad: 89,
  topPerformer: "Emma Smith",
  lowestAttendance: 80,
};
