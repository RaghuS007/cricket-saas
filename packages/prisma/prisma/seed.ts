import { PrismaClient, PlayerRole } from '@prisma/client'

const prisma = new PrismaClient()

const TEAMS = [
  { name: 'Mumbai Indians',              shortName: 'MI',   primaryColor: '#004BA0' },
  { name: 'Chennai Super Kings',         shortName: 'CSK',  primaryColor: '#F7C000' },
  { name: 'Royal Challengers Bengaluru', shortName: 'RCB',  primaryColor: '#EC1C24' },
  { name: 'Kolkata Knight Riders',       shortName: 'KKR',  primaryColor: '#3A225D' },
  { name: 'Delhi Capitals',              shortName: 'DC',   primaryColor: '#0078BC' },
  { name: 'Punjab Kings',               shortName: 'PBKS', primaryColor: '#ED1B24' },
  { name: 'Rajasthan Royals',            shortName: 'RR',   primaryColor: '#254AA5' },
  { name: 'Sunrisers Hyderabad',         shortName: 'SRH',  primaryColor: '#F7A721' },
]

// Role → background colour for avatar placeholder
const ROLE_COLOR: Record<string, string> = {
  BAT:           '1d4ed8', // blue
  BOWL:          '15803d', // green
  ALL_ROUNDER:   '7e22ce', // purple
  WICKET_KEEPER: 'b45309', // amber
}

function avatar(name: string, role: string) {
  const bg = ROLE_COLOR[role] ?? '374151'
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bg}&color=fff&size=256&bold=true`
}

const PLAYERS = [
  // Batters
  { name: 'Virat Kohli',        role: PlayerRole.BAT,           country: 'India',        basePrice: 20000000,  isOverseas: false },
  { name: 'Rohit Sharma',       role: PlayerRole.BAT,           country: 'India',        basePrice: 20000000,  isOverseas: false },
  { name: 'Shubman Gill',       role: PlayerRole.BAT,           country: 'India',        basePrice: 15000000,  isOverseas: false },
  { name: 'KL Rahul',           role: PlayerRole.BAT,           country: 'India',        basePrice: 15000000,  isOverseas: false },
  { name: 'Suryakumar Yadav',   role: PlayerRole.BAT,           country: 'India',        basePrice: 15000000,  isOverseas: false },
  { name: 'Faf du Plessis',     role: PlayerRole.BAT,           country: 'South Africa', basePrice: 10000000,  isOverseas: true  },
  // Wicket-keepers
  { name: 'Rishabh Pant',       role: PlayerRole.WICKET_KEEPER, country: 'India',        basePrice: 20000000,  isOverseas: false },
  { name: 'MS Dhoni',           role: PlayerRole.WICKET_KEEPER, country: 'India',        basePrice: 20000000,  isOverseas: false },
  { name: 'Sanju Samson',       role: PlayerRole.WICKET_KEEPER, country: 'India',        basePrice: 10000000,  isOverseas: false },
  { name: 'Jos Buttler',        role: PlayerRole.WICKET_KEEPER, country: 'England',      basePrice: 15000000,  isOverseas: true  },
  { name: 'Quinton de Kock',    role: PlayerRole.WICKET_KEEPER, country: 'South Africa', basePrice: 10000000,  isOverseas: true  },
  // All-rounders
  { name: 'Hardik Pandya',      role: PlayerRole.ALL_ROUNDER,   country: 'India',        basePrice: 15000000,  isOverseas: false },
  { name: 'Ravindra Jadeja',    role: PlayerRole.ALL_ROUNDER,   country: 'India',        basePrice: 15000000,  isOverseas: false },
  { name: 'Axar Patel',         role: PlayerRole.ALL_ROUNDER,   country: 'India',        basePrice: 10000000,  isOverseas: false },
  { name: 'Glenn Maxwell',      role: PlayerRole.ALL_ROUNDER,   country: 'Australia',    basePrice: 15000000,  isOverseas: true  },
  { name: 'Andre Russell',      role: PlayerRole.ALL_ROUNDER,   country: 'West Indies',  basePrice: 15000000,  isOverseas: true  },
  // Bowlers
  { name: 'Jasprit Bumrah',     role: PlayerRole.BOWL,          country: 'India',        basePrice: 20000000,  isOverseas: false },
  { name: 'Mohammed Shami',     role: PlayerRole.BOWL,          country: 'India',        basePrice: 10000000,  isOverseas: false },
  { name: 'Arshdeep Singh',     role: PlayerRole.BOWL,          country: 'India',        basePrice: 10000000,  isOverseas: false },
  { name: 'Yuzvendra Chahal',   role: PlayerRole.BOWL,          country: 'India',        basePrice:  7500000,  isOverseas: false },
  { name: 'Rashid Khan',        role: PlayerRole.BOWL,          country: 'Afghanistan',  basePrice: 20000000,  isOverseas: true  },
  { name: 'Pat Cummins',        role: PlayerRole.BOWL,          country: 'Australia',    basePrice: 20000000,  isOverseas: true  },
  { name: 'Mitchell Starc',     role: PlayerRole.BOWL,          country: 'Australia',    basePrice: 15000000,  isOverseas: true  },
  { name: 'Trent Boult',        role: PlayerRole.BOWL,          country: 'New Zealand',  basePrice: 10000000,  isOverseas: true  },
]

async function main() {
  console.log('🌱 Seeding IPL teams and players…')

  for (const t of TEAMS) {
    const existing = await prisma.team.findFirst({ where: { shortName: t.shortName, organizationId: null } })
    if (!existing) await prisma.team.create({ data: { ...t, organizationId: null } })
  }
  console.log(`  ✓ ${TEAMS.length} teams`)

  for (const p of PLAYERS) {
    const existing = await prisma.player.findFirst({ where: { name: p.name, organizationId: null } })
    if (existing) {
      // Backfill avatarUrl if missing
      if (!existing.avatarUrl) {
        await prisma.player.update({
          where: { id: existing.id },
          data: { avatarUrl: avatar(p.name, p.role) },
        })
      }
    } else {
      await prisma.player.create({
        data: { ...p, avatarUrl: avatar(p.name, p.role), organizationId: null },
      })
    }
  }
  console.log(`  ✓ ${PLAYERS.length} players (with avatars)`)

  console.log('✅ Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
