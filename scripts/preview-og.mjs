import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { ImageResponse } = await import('../node_modules/next/dist/compiled/@vercel/og/index.node.js')
const React = (await import('react')).default
const e = React.createElement

const BG      = '#353535'
const SURFACE = '#2d2d2d'
const ACCENT  = '#009BFF'
const TEXT    = '#ffffff'
const MUTED   = 'rgba(255,255,255,0.55)'
const BORDER  = 'rgba(255,255,255,0.08)'
const GREEN   = '#4ade80'
const RED     = '#f87171'
const YELLOW  = '#fbbf24'

const f = (style, ...children) => ({ style, children: children.length === 1 ? children[0] : children })

// ── Spotlight ──────────────────────────────────────────────────────────────────
function spotlight() {
  return e('div', { style: { width:'100%', height:'100%', display:'flex', flexDirection:'column', backgroundColor:BG, padding:56, fontFamily:'sans-serif', position:'relative' } },
    e('div', { style: { position:'absolute', top:0, left:0, width:6, height:'100%', backgroundColor:ACCENT } }),
    e('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:48 } },
      e('div', { style: { display:'flex', flexDirection:'column', gap:4 } },
        e('span', { style: { color:ACCENT, fontSize:20, fontWeight:700, letterSpacing:'0.15em' } }, 'HOLOTURE'),
        e('span', { style: { color:MUTED, fontSize:13 } }, 'DATA-POWERED SIGNALS'),
      ),
      e('div', { style: { display:'flex', alignItems:'center', padding:'10px 24px', backgroundColor:'#4ade8022', border:'2px solid #4ade80', borderRadius:12 } },
        e('span', { style: { color:GREEN, fontSize:20, fontWeight:900, letterSpacing:'0.1em' } }, 'BUY'),
      ),
    ),
    e('div', { style: { display:'flex', flexDirection:'column', flex:1, justifyContent:'center' } },
      e('span', { style: { color:MUTED, fontSize:16, fontWeight:600, letterSpacing:'0.12em', marginBottom:4 } }, 'TECHNOLOGY'),
      e('span', { style: { color:TEXT, fontSize:124, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1 } }, 'NVDA'),
      e('span', { style: { color:MUTED, fontSize:24, marginTop:10, marginBottom:40 } }, 'NVIDIA Corporation'),
      e('div', { style: { display:'flex', gap:16, width:'100%', marginBottom:24 } },
        e('div', { style: { flex:1, display:'flex', flexDirection:'column', backgroundColor:SURFACE, borderRadius:14, padding:22, gap:8 } },
          e('span', { style: { color:MUTED, fontSize:12, letterSpacing:'0.1em' } }, 'ENTRY ZONE'),
          e('span', { style: { color:TEXT, fontSize:22, fontWeight:700 } }, '$880 – $910'),
        ),
        e('div', { style: { flex:1, display:'flex', flexDirection:'column', backgroundColor:SURFACE, borderRadius:14, padding:22, gap:8 } },
          e('span', { style: { color:MUTED, fontSize:12, letterSpacing:'0.1em' } }, 'TARGET'),
          e('span', { style: { color:GREEN, fontSize:22, fontWeight:700 } }, '$1,100'),
        ),
      ),
      e('div', { style: { display:'flex', gap:16, width:'100%', marginBottom:32 } },
        e('div', { style: { flex:1, display:'flex', flexDirection:'column', backgroundColor:SURFACE, borderRadius:14, padding:22, gap:8 } },
          e('span', { style: { color:MUTED, fontSize:12, letterSpacing:'0.1em' } }, 'STOP LOSS'),
          e('span', { style: { color:TEXT, fontSize:22, fontWeight:700 } }, '$840'),
        ),
        e('div', { style: { flex:1, display:'flex', flexDirection:'column', backgroundColor:SURFACE, borderRadius:14, padding:22, gap:8 } },
          e('span', { style: { color:MUTED, fontSize:12, letterSpacing:'0.1em' } }, 'CONFIDENCE'),
          e('span', { style: { color:GREEN, fontSize:22, fontWeight:700 } }, '91%'),
        ),
      ),
      e('div', { style: { display:'flex', gap:8, alignItems:'center', marginBottom:32 } },
        e('span', { style: { color:MUTED, fontSize:16 } }, 'Time Horizon:'),
        e('span', { style: { color:TEXT, fontSize:16, fontWeight:600 } }, '2-3 months'),
      ),
      e('div', { style: { display:'flex', padding:28, backgroundColor:SURFACE, borderRadius:16, borderLeft:'4px solid '+ACCENT } },
        e('span', { style: { color:TEXT, fontSize:18, lineHeight:1.55, opacity:0.85 } }, 'NVDA is positioned for continued upside as hyperscaler AI capex accelerates into H2 2026.'),
      ),
    ),
    e('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:24, paddingTop:20, borderTop:'1px solid '+BORDER } },
      e('span', { style: { color:ACCENT, fontSize:14, fontWeight:700 } }, 'holoture.com'),
      e('span', { style: { color:MUTED, fontSize:12 } }, 'Not financial advice'),
    ),
  )
}

// ── Top 5 ──────────────────────────────────────────────────────────────────────
function top5() {
  const rows = [
    { ticker:'NVDA', sector:'Technology', type:'BUY',   target:'$1,100', conf:91, color:GREEN  },
    { ticker:'META', sector:'Technology', type:'BUY',   target:'$700',   conf:87, color:GREEN  },
    { ticker:'MSFT', sector:'Technology', type:'BUY',   target:'$520',   conf:84, color:GREEN  },
    { ticker:'AAPL', sector:'Consumer',   type:'WATCH', target:'$240',   conf:72, color:YELLOW },
    { ticker:'TSLA', sector:'Consumer',   type:'BUY',   target:'$340',   conf:68, color:GREEN  },
  ]
  return e('div', { style: { width:'100%', height:'100%', display:'flex', flexDirection:'column', backgroundColor:BG, padding:56, fontFamily:'sans-serif', position:'relative' } },
    e('div', { style: { position:'absolute', top:0, left:0, width:6, height:'100%', backgroundColor:ACCENT } }),
    e('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:40 } },
      e('div', { style: { display:'flex', flexDirection:'column', gap:6 } },
        e('span', { style: { color:TEXT, fontSize:48, fontWeight:900, letterSpacing:'-0.02em', lineHeight:1 } }, "TODAY'S TOP 5"),
        e('span', { style: { color:MUTED, fontSize:16 } }, 'Ranked by confidence'),
      ),
      e('span', { style: { color:ACCENT, fontSize:14, fontWeight:700, letterSpacing:'0.15em' } }, 'HOLOTURE'),
    ),
    e('div', { style: { display:'flex', flexDirection:'column', flex:1, gap:14 } },
      ...rows.map((row, i) =>
        e('div', { key:i, style: { display:'flex', alignItems:'center', backgroundColor:SURFACE, borderRadius:16, padding:'18px 28px', gap:20, border: i===0 ? '1px solid '+ACCENT+'44' : '1px solid '+BORDER } },
          e('span', { style: { color:i===0?ACCENT:MUTED, fontSize:20, fontWeight:900, width:32 } }, `#${i+1}`),
          e('div', { style: { display:'flex', flexDirection:'column', flex:1, gap:2 } },
            e('span', { style: { color:TEXT, fontSize:28, fontWeight:900 } }, row.ticker),
            e('span', { style: { color:MUTED, fontSize:13 } }, row.sector),
          ),
          e('div', { style: { display:'flex', padding:'6px 16px', backgroundColor:row.color+'18', borderRadius:8, border:'1px solid '+row.color+'50' } },
            e('span', { style: { color:row.color, fontSize:14, fontWeight:800, letterSpacing:'0.08em' } }, row.type),
          ),
          e('div', { style: { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, minWidth:90 } },
            e('span', { style: { color:GREEN, fontSize:18, fontWeight:700 } }, row.target),
            e('span', { style: { color:MUTED, fontSize:11 } }, 'target'),
          ),
          e('div', { style: { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, minWidth:64 } },
            e('span', { style: { color:row.color, fontSize:24, fontWeight:900 } }, `${row.conf}%`),
            e('div', { style: { display:'flex', width:56, height:4, backgroundColor:BORDER, borderRadius:2, overflow:'hidden' } },
              e('div', { style: { width:`${row.conf}%`, height:'100%', backgroundColor:row.color } }),
            ),
          ),
        )
      ),
    ),
    e('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:24, paddingTop:20, borderTop:'1px solid '+BORDER } },
      e('span', { style: { color:ACCENT, fontSize:14, fontWeight:700 } }, 'holoture.com'),
      e('span', { style: { color:MUTED, fontSize:12 } }, 'Not financial advice'),
    ),
  )
}

// ── Recap ──────────────────────────────────────────────────────────────────────
function recap() {
  const stats = [
    { label:'TOTAL', value:'24', color:TEXT   },
    { label:'BUY',   value:'15', color:GREEN  },
    { label:'WATCH', value:'7',  color:YELLOW },
    { label:'SHORT', value:'2',  color:RED    },
  ]
  return e('div', { style: { width:'100%', height:'100%', display:'flex', flexDirection:'column', backgroundColor:BG, padding:56, fontFamily:'sans-serif', position:'relative' } },
    e('div', { style: { position:'absolute', top:0, left:0, width:6, height:'100%', backgroundColor:ACCENT } }),
    e('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:40 } },
      e('div', { style: { display:'flex', flexDirection:'column', gap:6 } },
        e('span', { style: { color:TEXT, fontSize:48, fontWeight:900, letterSpacing:'-0.02em', lineHeight:1 } }, 'SIGNAL RECAP'),
        e('span', { style: { color:MUTED, fontSize:16 } }, "This week's full board summary"),
      ),
      e('span', { style: { color:ACCENT, fontSize:14, fontWeight:700, letterSpacing:'0.15em' } }, 'HOLOTURE'),
    ),
    e('div', { style: { display:'flex', gap:16, marginBottom:28 } },
      ...stats.map((s, i) =>
        e('div', { key:i, style: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', backgroundColor:SURFACE, borderRadius:18, padding:'24px 16px', gap:8, border:'1px solid '+BORDER } },
          e('span', { style: { color:s.color, fontSize:48, fontWeight:900, lineHeight:1 } }, s.value),
          e('span', { style: { color:MUTED, fontSize:12, letterSpacing:'0.1em' } }, s.label),
        )
      ),
    ),
    e('div', { style: { display:'flex', flexDirection:'column', backgroundColor:SURFACE, borderRadius:18, padding:28, marginBottom:20, border:'1px solid '+ACCENT+'44', gap:12 } },
      e('span', { style: { color:ACCENT, fontSize:12, fontWeight:700, letterSpacing:'0.12em' } }, 'HIGHEST CONFIDENCE PICK'),
      e('div', { style: { display:'flex', alignItems:'center', gap:20 } },
        e('span', { style: { color:TEXT, fontSize:40, fontWeight:900 } }, 'NVDA'),
        e('div', { style: { display:'flex', padding:'6px 16px', backgroundColor:GREEN+'18', borderRadius:8, border:'1px solid '+GREEN+'50' } },
          e('span', { style: { color:GREEN, fontSize:14, fontWeight:800 } }, 'BUY'),
        ),
        e('div', { style: { display:'flex', alignItems:'center', gap:8, flex:1 } },
          e('span', { style: { color:TEXT, fontSize:18 } }, '$880'),
          e('span', { style: { color:ACCENT } }, '→'),
          e('span', { style: { color:GREEN, fontSize:20, fontWeight:700 } }, '$1,100'),
        ),
        e('span', { style: { color:GREEN, fontSize:36, fontWeight:900 } }, '91%'),
      ),
      e('span', { style: { color:MUTED, fontSize:14 } }, 'NVDA is positioned for continued upside as hyperscaler AI capex accelerates into H2 2026.'),
    ),
    e('div', { style: { display:'flex', gap:16 } },
      e('div', { style: { flex:1, display:'flex', flexDirection:'column', backgroundColor:SURFACE, borderRadius:14, padding:20, gap:6 } },
        e('span', { style: { color:MUTED, fontSize:11, letterSpacing:'0.1em' } }, 'TOP SECTOR'),
        e('span', { style: { color:TEXT, fontSize:20, fontWeight:700 } }, 'Technology'),
        e('span', { style: { color:ACCENT, fontSize:14 } }, '8 signals'),
      ),
      e('div', { style: { flex:1, display:'flex', flexDirection:'column', backgroundColor:SURFACE, borderRadius:14, padding:20, gap:6 } },
        e('span', { style: { color:MUTED, fontSize:11, letterSpacing:'0.1em' } }, 'AVG CONFIDENCE'),
        e('span', { style: { color:TEXT, fontSize:20, fontWeight:700 } }, '79%'),
        e('div', { style: { display:'flex', width:'100%', height:4, backgroundColor:BORDER, borderRadius:2 } },
          e('div', { style: { width:'79%', height:'100%', backgroundColor:ACCENT, borderRadius:2 } }),
        ),
      ),
    ),
    e('div', { style: { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:24, paddingTop:20, borderTop:'1px solid '+BORDER } },
      e('span', { style: { color:ACCENT, fontSize:14, fontWeight:700 } }, 'holoture.com'),
      e('span', { style: { color:MUTED, fontSize:12 } }, 'Not financial advice'),
    ),
  )
}

// Render all three
const templates = [
  { name: 'spotlight', fn: spotlight },
  { name: 'top5',      fn: top5     },
  { name: 'recap',     fn: recap    },
]

for (const { name, fn } of templates) {
  const resp = new ImageResponse(fn(), { width: 1080, height: 1080 })
  const buf = Buffer.from(await resp.arrayBuffer())
  const outPath = `C:/Users/jaken/Desktop/holoture-og-${name}.png`
  writeFileSync(outPath, buf)
  console.log(`✓ ${name}: ${buf.length.toLocaleString()} bytes → ${outPath}`)
}
