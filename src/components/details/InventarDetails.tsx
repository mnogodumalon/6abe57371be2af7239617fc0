import type { Inventar, Kategorien, Lieferanten } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface InventarDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Inventar;
  /** N:1-Ziel „Kategorien": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  kategorienList: Kategorien[];
  /** Klick auf die Kategorien-Relation → overlay.push auf dessen Detail. */
  onOpenKategorien?: (record: Kategorien) => void;
  /** N:1-Ziel „Lieferanten": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  lieferantenList: Lieferanten[];
  /** Klick auf die Lieferanten-Relation → overlay.push auf dessen Detail. */
  onOpenLieferanten?: (record: Lieferanten) => void;
}

export function InventarDetails({
  record,
  kategorienList,
  onOpenKategorien,
  lieferantenList,
  onOpenLieferanten,
}: InventarDetailsProps) {
  const kategorieTarget = kategorienList.find(r => r.record_id === extractRecordId(record.fields.kategorie));
  const lieferantTarget = lieferantenList.find(r => r.record_id === extractRecordId(record.fields.lieferant));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('inventar', 'artikelname')} value={record.fields.artikelname} format="text" />
        <RecordField label={fieldLabel('inventar', 'artikelnummer')} value={record.fields.artikelnummer} format="text" />
        <RecordField label={fieldLabel('inventar', 'bestand')} value={record.fields.bestand} format="text" />
        <RecordField label={fieldLabel('inventar', 'mindestbestand')} value={record.fields.mindestbestand} format="text" />
        <RecordField label={fieldLabel('inventar', 'einheit')} value={record.fields.einheit} format="pill" />
        <RecordField label={fieldLabel('inventar', 'standort')} value={record.fields.standort} format="text" />
        <RecordField label={fieldLabel('inventar', 'einkaufspreis')} value={record.fields.einkaufspreis} format="text" />
        <RecordField label={fieldLabel('inventar', 'zustand')} value={record.fields.zustand} format="pill" />
        <RecordField label={fieldLabel('inventar', 'anschaffungsdatum')} value={record.fields.anschaffungsdatum} format="date" />
        <RecordField label={fieldLabel('inventar', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('inventar', 'bild')} className="md:col-span-2">
          {record.fields.bild ? (
            <MediaThumbnail src={record.fields.bild as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('inventar', 'kategorie')}
          name={kategorieTarget?.fields.kategoriename ?? '—'}
          meta={undefined}
          onClick={kategorieTarget && onOpenKategorien ? () => onOpenKategorien!(kategorieTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('inventar', 'lieferant')}
          name={lieferantTarget?.fields.firmenname ?? '—'}
          meta={[lieferantTarget?.fields.telefon, lieferantTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={lieferantTarget && onOpenLieferanten ? () => onOpenLieferanten!(lieferantTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.INVENTAR} recordId={record.record_id} />
    </>
  );
}
