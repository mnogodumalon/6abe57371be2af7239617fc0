import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { useState } from 'react';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatCurrency, formatDate, lookupKey } from '@/lib/formatters';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { LivingAppsService } from '@/services/livingAppsService';
import {
  IconAlertTriangle,
  IconPlus,
  IconPackage,
  IconTruck,
  IconCategory,
  IconTool,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    kategorien,
    lieferanten,
    inventar,
    setInventar,
    fetchAll,
  } = data;

  const crud = useEntityCrud(data);
  const enrichedInventar = crud.enriched.inventar;
  const clock = useClock();

  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Derived state ---
  const unterbestand = enrichedInventar.filter(
    r => r.fields.bestand != null && r.fields.mindestbestand != null &&
      r.fields.bestand < r.fields.mindestbestand
  );
  const defekte = enrichedInventar.filter(
    r => lookupKey(r.fields.zustand) === 'defekt'
  );
  const totalWert = enrichedInventar.reduce(
    (sum, r) => sum + (r.fields.bestand ?? 0) * (r.fields.einkaufspreis ?? 0), 0
  );

  // Filtered inventar for table
  const filteredInventar = enrichedInventar.filter(r => {
    if (filterKey === 'unterbestand') {
      return r.fields.bestand != null && r.fields.mindestbestand != null &&
        r.fields.bestand < r.fields.mindestbestand;
    }
    if (filterKey === 'defekt') {
      return lookupKey(r.fields.zustand) === 'defekt';
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (r.fields.artikelname ?? '').toLowerCase().includes(q) ||
        (r.fields.artikelnummer ?? '').toLowerCase().includes(q) ||
        (r.kategorieName ?? '').toLowerCase().includes(q) ||
        (r.lieferantName ?? '').toLowerCase().includes(q) ||
        (r.fields.standort ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Chart rows — bestand per Kategorie
  const chartRows = enrichedInventar.map(r => ({
    id: `inventar:${r.record_id}`,
    data: r,
  }));

  // Tone helper for stock level
  function stockTone(r: typeof enrichedInventar[0]) {
    if (r.fields.bestand == null) return 'text-muted-foreground';
    if (r.fields.mindestbestand != null && r.fields.bestand < r.fields.mindestbestand)
      return 'text-destructive font-semibold';
    if (r.fields.mindestbestand != null && r.fields.bestand < r.fields.mindestbestand * 1.2)
      return 'text-amber-600 font-medium';
    return 'text-foreground';
  }

  function zustandBadgeColor(key: string | undefined) {
    if (key === 'neu') return 'text-emerald-600';
    if (key === 'gut') return 'text-sky-600';
    if (key === 'gebraucht') return 'text-amber-600';
    if (key === 'defekt') return 'text-destructive';
    return 'text-muted-foreground';
  }

  // Context line
  const contextNames = unterbestand.length > 0
    ? namen(unterbestand.map(r => r.fields.artikelname ?? ''))
    : null;

  const contextLine = unterbestand.length > 0
    ? tx`${contextNames} unter Mindestbestand — bitte nachbestellen.`
    : kategorien.length === 0 && inventar.length === 0
      ? tx('Lege deine erste Kategorie und Artikel an, um loszulegen.')
      : tx('Alle Artikel ausreichend bevorratet — gute Arbeit!');

  // Hero: defekte Artikel oder kritischer Unterbestand
  const heroCandidates = defekte.length > 0 ? defekte : [];
  const heroNames = heroCandidates.length > 0
    ? namen(heroCandidates.map(r => r.fields.artikelname ?? ''))
    : null;

  const handleMarkRepaired = async () => {
    if (heroCandidates.length === 0) return;
    const target = heroCandidates[0];
    const prev = inventar.map(r => ({ ...r }));
    setInventar(inventar.map(r =>
      r.record_id === target.record_id
        ? { ...r, fields: { ...r.fields, zustand: { key: 'gut', label: tx('Gut') } } }
        : r
    ));
    undoToast(tx`${target.fields.artikelname ?? ''} — als gut markiert`, async () => {
      setInventar(prev);
      await LivingAppsService.updateInventarEntry(target.record_id, { zustand: 'defekt' });
    });
    try {
      await LivingAppsService.updateInventarEntry(target.record_id, { zustand: 'gut' });
    } catch {
      setInventar(prev);
      fetchAll();
    }
  };

  // Empty state
  if (inventar.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{tx('Richte dein Werkstatt-Inventar ein.')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-6 rounded-2xl border border-dashed border-border bg-card">
          <IconTool size={48} className="text-muted-foreground" stroke={1.5} />
          <div className="text-center space-y-1">
            <p className="font-semibold text-lg">{tx('Noch keine Artikel erfasst')}</p>
            <p className="text-muted-foreground text-sm">{tx('Füge deinen ersten Artikel hinzu, um den Überblick zu behalten.')}</p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Button onClick={() => crud.kategorien.openCreate({})}>
              <IconCategory size={16} className="shrink-0 mr-1" />
              {tx('Erste Kategorie anlegen')}
            </Button>
            <Button variant="outline" onClick={() => crud.inventar.openCreate({})}>
              <IconPackage size={16} className="shrink-0 mr-1" />
              {tx('Ersten Artikel aufnehmen')}
            </Button>
          </div>
        </div>
        {crud.surfaces}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{contextLine}</p>
        </div>
        <Button onClick={() => crud.inventar.openCreate({})}>
          <IconPlus size={16} className="shrink-0 mr-1" />
          {tx('Artikel hinzufügen')}
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroCandidates.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{ label: tx('Als repariert markieren'), onClick: handleMarkRepaired }}
          >
            <b>{heroNames}</b> {heroCandidates.length === 1 ? tx('ist als defekt markiert') : tx('sind als defekt markiert')} — {tx('bitte prüfen und reparieren.')}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={appLabel('inventar')}
              value={inventar.length}
              icon={<IconPackage size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title={tx('Unterbestand')}
              value={unterbestand.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={unterbestand.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilterKey(f => f === 'unterbestand' ? null : 'unterbestand')}
              active={filterKey === 'unterbestand'}
            />
            <StatStripItem
              title={tx('Defekte Artikel')}
              value={defekte.length}
              icon={<IconTool size={16} className="shrink-0" />}
              tone={defekte.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilterKey(f => f === 'defekt' ? null : 'defekt')}
              active={filterKey === 'defekt'}
            />
            <StatStripItem
              title={appLabel('kategorien')}
              value={kategorien.length}
              icon={<IconCategory size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title={appLabel('lieferanten')}
              value={lieferanten.length}
              icon={<IconTruck size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title={tx('Lagerwert (€)')}
              value={formatCurrency(totalWert)}
              tone="primary"
            />
          </StatStrip>
        }
        aside={
          <>
            <WorkList
              title={tx('Unterbestand — nachbestellen')}
              items={unterbestand.slice(0, 8).map(r => ({
                id: r.record_id,
                title: r.fields.artikelname ?? '—',
                secondLine: (
                  <>
                    <span className="text-destructive font-medium">
                      {r.fields.bestand} / {r.fields.mindestbestand} {r.fields.einheit?.label ?? ''}
                    </span>
                    {r.kategorieName ? (
                      <span className="text-muted-foreground"> · {r.kategorieName}</span>
                    ) : null}
                  </>
                ),
                action: r.lieferantName
                  ? { label: tx('Lieferant öffnen'), onClick: () => {
                      const lief = lieferanten.find(l => l.fields.firmenname === r.lieferantName);
                      if (lief) crud.lieferanten.openDetail(lief);
                    }}
                  : undefined,
              }))}
              onItemClick={id => {
                const rec = enrichedInventar.find(r => r.record_id === id);
                if (rec) crud.inventar.openDetail(rec);
              }}
              empty={{ text: tx('Alle Artikel ausreichend bevorratet'), action: { label: tx('Artikel hinzufügen'), onClick: () => crud.inventar.openCreate({}) } }}
            />
            <ChartWidget
              title={tx('Bestand nach Kategorie')}
              rows={chartRows}
              dimension={{
                kind: 'category',
                accessor: r => r.data.kategorieName || null,
                label: tx('Kategorie'),
              }}
              measure={{
                aggregate: 'sum',
                label: tx('Bestand'),
                value: r => r.data.fields.bestand ?? null,
                format: 'number',
              }}
            />
          </>
        }
        primary={
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Search bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <input
                type="search"
                placeholder={tx('Artikel suchen…')}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setFilterKey(null); }}
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {filterKey && (
                <button
                  className="text-xs text-primary underline shrink-0"
                  onClick={() => setFilterKey(null)}
                >
                  {tx('Filter aufheben')}
                </button>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">{tx('Artikel')}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">{tx('Kategorie')}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">{tx('Bestand')}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">{tx('Zustand')}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">{tx('Standort')}</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">{tx('Preis')}</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredInventar.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                        {tx('Keine Artikel gefunden')}
                      </td>
                    </tr>
                  ) : filteredInventar.map((r, i) => (
                    <tr
                      key={r.record_id}
                      className={`border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                      onClick={() => crud.inventar.openDetail(r)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[180px]">{r.fields.artikelname}</div>
                        {r.fields.artikelnummer && (
                          <div className="text-xs text-muted-foreground">{r.fields.artikelnummer}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">
                        {r.kategorieName || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={stockTone(r)}>
                          {r.fields.bestand ?? '—'}
                          {r.fields.einheit?.label ? ` ${r.fields.einheit.label}` : ''}
                        </span>
                        {r.fields.mindestbestand != null && (
                          <span className="text-xs text-muted-foreground ml-1">
                            / {r.fields.mindestbestand}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.fields.zustand ? (
                          <span className={`text-sm ${zustandBadgeColor(lookupKey(r.fields.zustand))}`}>
                            {r.fields.zustand.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]">
                        {r.fields.standort || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.fields.einkaufspreis != null ? formatCurrency(r.fields.einkaufspreis) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <span
                            role="button"
                            tabIndex={0}
                            className="text-xs text-primary underline shrink-0 cursor-pointer"
                            onClick={e => { e.stopPropagation(); crud.inventar.openEdit(r); }}
                            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), crud.inventar.openEdit(r))}
                          >
                            {tx('Bearbeiten')}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-border">
              {filteredInventar.length === 0 ? (
                <div className="text-center text-muted-foreground py-10 text-sm">
                  {tx('Keine Artikel gefunden')}
                </div>
              ) : filteredInventar.map(r => (
                <div
                  key={r.record_id}
                  className="px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => crud.inventar.openDetail(r)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.fields.artikelname}</div>
                      {r.fields.artikelnummer && (
                        <div className="text-xs text-muted-foreground">{r.fields.artikelnummer}</div>
                      )}
                    </div>
                    {r.fields.zustand && (
                      <span className={`text-xs shrink-0 ${zustandBadgeColor(lookupKey(r.fields.zustand))}`}>
                        {r.fields.zustand.label}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                    <span className={stockTone(r)}>
                      {r.fields.bestand ?? '—'}{r.fields.einheit?.label ? ` ${r.fields.einheit.label}` : ''}
                      {r.fields.mindestbestand != null && (
                        <span className="text-muted-foreground font-normal"> / {r.fields.mindestbestand}</span>
                      )}
                    </span>
                    {r.kategorieName && (
                      <span className="text-muted-foreground">{r.kategorieName}</span>
                    )}
                    {r.fields.standort && (
                      <span className="text-muted-foreground">{r.fields.standort}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer summary */}
            <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
              <span>{filteredInventar.length} {tx('von')} {inventar.length} {tx('Artikel')}</span>
              <span>{tx('Lagerwert')}: <b className="text-foreground">{formatCurrency(totalWert)}</b></span>
            </div>
          </div>
        }
      />
      {crud.surfaces}
    </div>
  );
}
