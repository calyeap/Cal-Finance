# FCFF DCF, mid-year, 10y, g=3%, r=9%. $M.
R,G=0.09,0.03
rev0=79666   # TTM to 2026-06-30
netdebt=7050+47858+222+1140-8950   # debt + op leases (FY25) - cash (2026-06-30)
sh=893.7     # diluted wtd Q2 2026, M
tax=0.19
def interp(a,b,n): return [a+(b-a)*i/(n-1) for i in range(n)]
sc={
 'Bear':dict(g=[0.15,0.07,0.04,0.02,0.01,0.0,-0.01,0.0,0.01,0.02], m=interp(0.40,0.30,10), cx=interp(0.11,0.05,10)),
 'Base':dict(g=[0.24,0.16,0.11,0.08,0.06,0.05,0.04,0.035,0.03,0.03], m=[0.43,0.44,0.44,0.44,0.43,0.42,0.41,0.40,0.39,0.38], cx=interp(0.11,0.05,10)),
 'Bull':dict(g=[0.30,0.22,0.15,0.11,0.09,0.07,0.06,0.05,0.04,0.03], m=[0.45,0.47,0.48,0.48,0.48,0.47,0.46,0.45,0.44,0.43], cx=interp(0.11,0.05,10)),
}
out={}
for k,s in sc.items():
  rev=rev0; pv=0; rows=[]
  for t in range(10):
    prev=rev; rev=rev*(1+s['g'][t])
    ebit=rev*s['m'][t]; da=rev*(0.027+0.013*t/9)  # D&A 2.7%->4.0% as new plants depreciate
    capex=rev*s['cx'][t]; dnwc=0.08*(rev-prev)
    fcff=ebit*(1-tax)+da-capex-dnwc
    pv+=fcff/(1+R)**(t+0.5); rows.append((t+1,round(rev),round(ebit),round(fcff)))
  # terminal: last-year FCFF grown at g, with capex normalised to D&A*1.15 and NWC 8% of growth
  rT=rev*(1+G); ebitT=rT*s['m'][-1]; daT=rT*0.04
  fT=ebitT*(1-tax)+daT-daT*1.15-0.08*(rT-rev)
  tv=fT/(R-G); pvtv=tv/(1+R)**9.5   # mid-year convention consistent with year-10 cash flow at 9.5
  ev=pv+pvtv; eq=ev-netdebt; ps=eq/sh
  out[k]=ps
  print(k,'PV FCFF',round(pv),'PV TV',round(pvtv),'TV share',round(pvtv/ev,2),'EV',round(ev),'Equity',round(eq),'per sh',round(ps,1))
  for r in rows: print('   ',r)
print('netdebt',netdebt)
px=1240.34; print('price/base',round(px/out['Base'],3))
