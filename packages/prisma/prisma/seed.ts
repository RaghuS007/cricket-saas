import { PrismaClient, PlayerRole } from '@prisma/client'

const prisma = new PrismaClient()

const TEAMS = [
  { name: 'Mumbai Indians',           shortName: 'MI',   primaryColor: '#004BA0' },
  { name: 'Chennai Super Kings',      shortName: 'CSK',  primaryColor: '#F7C000' },
  { name: 'Royal Challengers Bengaluru', shortName: 'RCB', primaryColor: '#EC1C24' },
  { name: 'Kolkata Knight Riders',    shortName: 'KKR',  primaryColor: '#3A225D' },
  { name: 'Delhi Capitals',           shortName: 'DC',   primaryColor: '#0078BC' },
  { name: 'Punjab Kings',             shortName: 'PBKS', primaryColor: '#ED1B24' },
  { name: 'Rajasthan Royals',         shortName: 'RR',   primaryColor: '#254AA5' },
  { name: 'Sunrisers Hyderabad',      shortName: 'SRH',  primaryColor: '#F7A721' },
]

const PLAYERS = [
  // Batters
  { name: 'Virat Kohli',       role: PlayerRole.BAT,           country: 'India',     basePrice: 200, isOverseas: false },
  { name: 'Rohit Sharma',      role: PlayerRole.BAT,           country: 'India',     basePrice: 200, isOverseas: false },
  { name: 'Shubman Gill',      role: PlayerRole.BAT,           country: 'India',     basePrice: 150, isOverseas: false },
  { name: 'KL Rahul',          role: PlayerRole.BAT,           country: 'India',     basePrice: 150, isOverseas: false },
  { name: 'Suryakumar Yadav',  role: PlayerRole.BAT,           country: 'India',     basePrice: 150, isOverseas: false },
  { name: 'Faf du Plessis',    role: PlayerRole.BAT,           country: 'South Africa', basePrice: 100, isOverseas: true },
  // Wicket-keepers
  { name: 'Rishabh Pant',      role: PlayerRole.WICKET_KEEPER, country: 'India',     basePrice: 200, isOverseas: false },
  { name: 'MS Dhoni',          role: PlayerRole.WICKET_KEEPER, country: 'India',     basePrice: 200, isOverseas: false },
  { name: 'Sanju Samson',      role: PlayerRole.WICKET_KEEPER, country: 'India',     basePrice: 100, isOverseas: false },
  { name: 'Jos Buttler',       role: PlayerRole.WICKET_KEEPER, country: 'England',   basePrice: 150, isOverseas: true },
  { name: 'Quinton de Kock',   role: PlayerRole.WICKET_KEEPER, country: 'South Africa', basePrice: 100, isOverseas: true },
  // All-rounders
  { name: 'Hardik Pandya',     role: PlayerRole.ALL_ROUNDER,   country: 'India',     basePrice: 150, isOverseas: false },
  { name: 'Ravindra Jadeja',   role: PlayerRole.ALL_ROUNDER,   country: 'India',     basePrice: 150, isOverseas: false },
  { name: 'Axar Patel',        role: PlayerRole.ALL_ROUNDER,   country: 'India',     basePrice: 100, isOverseas: false },
  { name: 'Glenn Maxwell',     role: PlayerRole.ALL_ROUNDER,   country: 'Australia', basePrice: 150, isOverseas: true },
  { name: 'Andre Russell',     role: PlayerRole.ALL_ROUNDER,   country: 'West Indies', basePrice: 150, isOverseas: true },
  // Bowlers
  { name: 'Jasprit Bumrah',    role: PlayerRole.BOWL,          country: 'India',     basePrice: 200, isOverseas: false },
  { name: 'Mohammed Shami',    role: PlayerRole.BOWL,          country: 'India',     basePrice: 100, isOverseas: false },
  { name: 'Arshdeep Singh',    role: PlayerRole.BOWL,          country: 'India',     basePrice: 100, isOverseas: false },
  { name: 'Yuzvendra Chahal',  role: PlayerRole.BOWL,          country: 'India',     basePrice:  75, isOverseas: false },
  { name: 'Rashid Khan',       role: PlayerRole.BOWL,          country: 'Afghanistan', basePrice: 200, isOverseas: true },
  { name: 'Pat Cummins',       role: PlayerRole.BOWL,          country: 'Australia', basePrice: 200, isOverseas: true },
  { name: 'Mitchell Starc',    role: PlayerRole.BOWL,          country: 'Australia', basePrice: 150, isOverseas: true },
  { name: 'Trent Boult',       role: PlayerRole.BOWL,          country: 'New Zealand', basePrice: 100, isOverseas: true },
]

async function main() {
  console.log('🌱 Seeding IPL teams and players…')

  for (const t of TEAMS) {
    const existing = await prisma.team.findFirst({ where: { shortName: t.shortName, organizationId: null } })
    if (!existing) await prisma.team.create({ data: { ...t, organizationId: null } })
  }
  console.log(`  ✓ ${TEAMS.length} teams`)

  for (const p of PLAYERS) {
    // Use name as idempotency key for global seed players
    const existing = await prisma.player.findFirst({
      where: { name: p.name, organizationId: null },
    })
    if (!existing) {
      await prisma.player.create({ data: { ...p, basePrice: p.basePrice, organizationId: null } })
    }
  }
  console.log(`  ✓ ${PLAYERS.length} players`)

  console.log('✅ Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
