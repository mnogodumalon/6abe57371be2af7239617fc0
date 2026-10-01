/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'kategorien'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.kategorien.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.kategorien.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.kategorien.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.kategorien              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   kategorien: kategoriename, beschreibung  ·  ← inventar (list + contextual +)
 *   lieferanten: firmenname, ansprechpartner_vorname, ansprechpartner_nachname, telefon, email, webseite, strasse, hausnummer, …  ·  ← inventar (list + contextual +)
 *   inventar: artikelname, artikelnummer, kategorie, lieferant, bestand, mindestbestand, einheit, standort, …  ·  → kategorien · → lieferanten
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Kategorien, Lieferanten, Inventar } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichInventar } from '@/lib/enrich';
import type { EnrichedInventar } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { KategorienDialog, type KategorienDialogDefaults } from '@/components/dialogs/KategorienDialog';
import { KategorienDetails } from '@/components/details/KategorienDetails';
import { LieferantenDialog, type LieferantenDialogDefaults } from '@/components/dialogs/LieferantenDialog';
import { LieferantenDetails } from '@/components/details/LieferantenDetails';
import { InventarDialog, type InventarDialogDefaults } from '@/components/dialogs/InventarDialog';
import { InventarDetails } from '@/components/details/InventarDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'kategorien'; record: Kategorien }
  | { type: 'lieferanten'; record: Lieferanten }
  | { type: 'inventar'; record: EnrichedInventar };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  kategorien: EntityCrudApi<Kategorien, KategorienDialogDefaults>;
  lieferanten: EntityCrudApi<Lieferanten, LieferantenDialogDefaults>;
  inventar: EntityCrudApi<Inventar, InventarDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { kategorien: Kategorien[]; lieferanten: Lieferanten[]; inventar: EnrichedInventar[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [kategorienDialog, setKategorienDialog] = useState<{ defaults?: KategorienDialogDefaults; editing?: Kategorien } | null>(null);
  const [lieferantenDialog, setLieferantenDialog] = useState<{ defaults?: LieferantenDialogDefaults; editing?: Lieferanten } | null>(null);
  const [inventarDialog, setInventarDialog] = useState<{ defaults?: InventarDialogDefaults; editing?: Inventar } | null>(null);
  const enrichedInventar = useMemo(() => enrichInventar(data.inventar, { kategorienMap: data.kategorienMap, lieferantenMap: data.lieferantenMap }), [data.inventar, data.kategorienMap, data.lieferantenMap]);

  function detailKategorien(record: Kategorien, push = false) {
    const item: OverlayItem = { type: 'kategorien', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitKategorien(fields: Kategorien['fields']) {
    const editing = kategorienDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setKategorien(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateKategorienEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('kategorien')} — ${t('crud_updated')}`, async () => {
        data.setKategorien(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateKategorienEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createKategorienEntry(fields);
      undoToast(`${appLabel('kategorien')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailLieferanten(record: Lieferanten, push = false) {
    const item: OverlayItem = { type: 'lieferanten', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitLieferanten(fields: Lieferanten['fields']) {
    const editing = lieferantenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setLieferanten(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateLieferantenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('lieferanten')} — ${t('crud_updated')}`, async () => {
        data.setLieferanten(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateLieferantenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createLieferantenEntry(fields);
      undoToast(`${appLabel('lieferanten')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailInventar(record: Inventar, push = false) {
    const rec = enrichedInventar.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'inventar', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitInventar(fields: Inventar['fields']) {
    const editing = inventarDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setInventar(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateInventarEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('inventar')} — ${t('crud_updated')}`, async () => {
        data.setInventar(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateInventarEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createInventarEntry(fields);
      undoToast(`${appLabel('inventar')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <KategorienDialog
        open={kategorienDialog !== null}
        onClose={() => setKategorienDialog(null)}
        onSubmit={submitKategorien}
        defaultValues={kategorienDialog?.defaults}
        recordId={kategorienDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Kategorien']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kategorien']}
      />
      <LieferantenDialog
        open={lieferantenDialog !== null}
        onClose={() => setLieferantenDialog(null)}
        onSubmit={submitLieferanten}
        defaultValues={lieferantenDialog?.defaults}
        recordId={lieferantenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Lieferanten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Lieferanten']}
      />
      <InventarDialog
        open={inventarDialog !== null}
        onClose={() => setInventarDialog(null)}
        onSubmit={submitInventar}
        defaultValues={inventarDialog?.defaults}
        recordId={inventarDialog?.editing?.record_id}
        kategorienList={data.kategorien}
        lieferantenList={data.lieferanten}
        enablePhotoScan={AI_PHOTO_SCAN['Inventar']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Inventar']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'kategorien') {
            return (
              <>
                <RecordHeader title={top.record.fields.kategoriename ?? appLabel('kategorien')} subtitle={undefined} />
                <KategorienDetails
                  record={top.record}
                  inventarList={data.inventar}
                  onOpenInventar={(r) => detailInventar(r, true)}
                  onAddInventar={() => setInventarDialog({ defaults: { kategorie: createRecordUrl(APP_IDS.KATEGORIEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'lieferanten') {
            return (
              <>
                <RecordHeader title={top.record.fields.firmenname ?? appLabel('lieferanten')} subtitle={undefined} />
                <LieferantenDetails
                  record={top.record}
                  inventarList={data.inventar}
                  onOpenInventar={(r) => detailInventar(r, true)}
                  onAddInventar={() => setInventarDialog({ defaults: { lieferant: createRecordUrl(APP_IDS.LIEFERANTEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'inventar') {
            return (
              <>
                <RecordHeader title={top.record.fields.artikelname ?? appLabel('inventar')} subtitle={top.record.fields.anschaffungsdatum ? formatDate(top.record.fields.anschaffungsdatum) : undefined} />
                <InventarDetails
                  record={top.record}
                  kategorienList={data.kategorien}
                  onOpenKategorien={(r) => detailKategorien(r, true)}
                  lieferantenList={data.lieferanten}
                  onOpenLieferanten={(r) => detailLieferanten(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'kategorien') setKategorienDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'lieferanten') setLieferantenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'inventar') setInventarDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    kategorien: {
      openCreate: (defaults?: KategorienDialogDefaults) => setKategorienDialog({ defaults }),
      openEdit: (record: Kategorien) => setKategorienDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Kategorien) => detailKategorien(record, false),
    },
    lieferanten: {
      openCreate: (defaults?: LieferantenDialogDefaults) => setLieferantenDialog({ defaults }),
      openEdit: (record: Lieferanten) => setLieferantenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Lieferanten) => detailLieferanten(record, false),
    },
    inventar: {
      openCreate: (defaults?: InventarDialogDefaults) => setInventarDialog({ defaults }),
      openEdit: (record: Inventar) => setInventarDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Inventar) => detailInventar(record, false),
    },
    enriched: { kategorien: data.kategorien, lieferanten: data.lieferanten, inventar: enrichedInventar },
  };
}
