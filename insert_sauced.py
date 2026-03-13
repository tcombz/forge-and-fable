"""
Insert Sauced processing lines before the Echo lines in both:
  - computeEnemyAttackPhase (first occurrence, ~line 962 before changes)
  - computeEnemyTurn (second occurrence, ~line 998 before changes)
"""

SAUCED_LINES = [
  '  s.playerBoard.filter((c) => (c.keywords || []).includes("Sauced")).forEach((att) => { if (s.enemyBoard.length > 0) { const idx = Math.floor(Math.random() * s.enemyBoard.length); const tgt = s.enemyBoard[idx]; s.enemyBoard = s.enemyBoard.map((c,i) => i===idx ? {...c, currentHp: c.currentHp-1} : c).filter((c) => c.currentHp > 0); L(`${att.name} splashes ${tgt.name} for 1!`); } });\n',
  '  s.enemyBoard.filter((c) => (c.keywords || []).includes("Sauced")).forEach((att) => { if (s.playerBoard.length > 0) { const idx = Math.floor(Math.random() * s.playerBoard.length); const tgt = s.playerBoard[idx]; s.playerBoard = s.playerBoard.map((c,i) => i===idx ? {...c, currentHp: c.currentHp-1} : c).filter((c) => c.currentHp > 0); L(`${att.name} splashes ${tgt.name} for 1!`); } });\n',
]

ECHO_LINE = '  s.playerBoard.filter((c) => (c.keywords || []).includes("Echo") && !c.echoQueued)'

path = 'src/App.jsx'
lines = open(path, encoding='utf-8').readlines()

echo_occurrences = [i for i, l in enumerate(lines) if l.startswith(ECHO_LINE)]
print(f'Found Echo lines at (0-indexed): {echo_occurrences}')

# Insert Sauced lines before EACH Echo line (insert in reverse order to preserve indices)
for echo_idx in reversed(echo_occurrences):
    lines[echo_idx:echo_idx] = SAUCED_LINES
    print(f'Inserted Sauced lines before line {echo_idx+1}')

open(path, 'w', encoding='utf-8').writelines(lines)
print('Done')
