import json

d = json.load(open('coverage.json'))
print(f"Total Backend Coverage: {d['totals']['percent_covered']:.1f}%")
print(f"Lines Covered: {d['totals']['covered_lines']} / {d['totals']['num_statements']}")
print()
print("Per module coverage (lowest first):")
print("-" * 80)

files = []
for k, v in d['files'].items():
    name = k.replace('backend\\\\', '').replace('backend/', '')
    pct = v['summary']['percent_covered']
    files.append((name, pct, v['summary']['covered_lines'], v['summary']['num_statements']))

files.sort(key=lambda x: x[1])

for name, pct, covered, total in files:
    bar = '#' * int(pct / 5) + '.' * (20 - int(pct / 5))
    print(f"{name:50} [{bar}] {pct:5.1f}% ({covered}/{total})")
