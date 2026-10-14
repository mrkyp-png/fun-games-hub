from pathlib import Path
import xml.etree.ElementTree as ET
p=Path('mole/assets/rhythm-b')
r=ET.parse(p/'circuit-rim.svg').getroot();ns={'s':'http://www.w3.org/2000/svg'};d=r.find("s:path[@data-outer-rim='true']",ns).get('d')
parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 952 2078" preserveAspectRatio="none"><rect width="952" height="2078" fill="white"/><g fill="black">']
for i in range(9):
 cx=176+i%3*300;cy=176+i//3*300;parts.append(f'<circle cx="{cx}" cy="{cy}" r="144.2"/>')
 sx=268/1164;sy=268/1116;cy=1286+i//3*300;parts.append(f'<path d="{d}" transform="matrix({sx} 0 0 {sy} {cx-646*sx} {cy-621*sy})"/>')
parts.append('</g></svg>');(p/'combo-background-mask.svg').write_text(''.join(parts),encoding='utf-8')
