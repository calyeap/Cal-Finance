import json, sys
G=0.03
def dcf(rev0, growth, margin, tax, s2c, ronic, r, extra_reinv=None):
    assert len(growth)==10 and len(margin)==10 and len(tax)==10
    rev=rev0; pv=0; rows=[]
    for t in range(10):
        nr=rev*(1+growth[t]); ebit=nr*margin[t]; nopat=ebit*(1-tax[t])
        reinv=(nr-rev)/s2c + (extra_reinv[t] if extra_reinv else 0)
        f=nopat-reinv; df=(1+r)**-(t+0.5); pv+=f*df
        rows.append((t+1,nr,margin[t],ebit,nopat,reinv,f,df)); rev=nr
    nopat11=rows[-1][4]*(1+G); f11=nopat11*(1-G/ronic)
    tv=f11/(r-G); pvtv=tv*(1+r)**-10
    return pv, pvtv, rows
def lin(a,b,n=10): return [a+(b-a)*i/(n-1) for i in range(n)]
def fade(first, end, n=10):  # explicit first values then linear to end
    k=len(first); return first+lin(first[-1],end,n-k+1)[1:]
C=json.load(open(sys.argv[1]))
out={}
for tk,c in C.items():
    out[tk]={}
    for sc,d in c["scen"].items():
        g=fade(d["g_first"],G) if "g_first" in d else d["g"]
        m=lin(d["m"][0],d["m"][1]) if len(d["m"])==2 else d["m"]
        tx=lin(d["tax"][0],d["tax"][1])
        pv,pvtv,rows=dcf(c["rev0"],g,m,tx,d["s2c"],d["ronic"],c["r"],d.get("extra"))
        ev=pv+pvtv; eq=ev-c["netdebt"]; ps=eq/c["shares"]
        out[tk][sc]=dict(g=g,m=m,tax=tx,pv=pv,pvtv=pvtv,ev=ev,eq=eq,ps=ps,rows=rows)
        print(tk,sc,f"EV {ev/1e3:,.0f}B  PV(FCFF) {pv/1e3:,.0f}  PV(TV) {pvtv/1e3:,.0f} ({pvtv/ev:.0%})  eq {eq/1e3:,.0f}B  /sh {ps:,.2f}  ratio {c['price']/ps:.2f}  Y1rev {rows[0][1]/1e3:,.0f} Y10rev {rows[-1][1]/1e3:,.0f} Y10FCFF {rows[-1][6]/1e3:,.1f}")
json.dump(out,open(sys.argv[2],"w"),default=float)
