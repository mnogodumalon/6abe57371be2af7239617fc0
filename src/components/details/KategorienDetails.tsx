import type { Kategorien, Inventar } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface KategorienDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Kategorien;
  /** 1:N „Inventar" (kategorie): VOLLE Liste — der Block filtert auf diesen Record. */
  inventarList: Inventar[];
  /** Zeilen-Klick → overlay.push auf das Inventar-Detail (nie der Edit-Dialog). */
  onOpenInventar: (record: Inventar) => void;
  /** Kontextuelles „+": öffnet den Inventar-Dialog mit diesem Record vorgesetzt. */
  onAddInventar: () => void;
}

export function KategorienDetails({
  record,
  inventarList,
  onOpenInventar,
  onAddInventar,
}: KategorienDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('kategorien', 'kategoriename')} value={record.fields.kategoriename} format="text" />
        <RecordField label={fieldLabel('kategorien', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('inventar')}
        items={inventarList.filter(r => extractRecordId(r.fields.kategorie) === record.record_id)}
        map={r => ({ name: r.fields.artikelname ?? appLabel('inventar'), meta: r.fields.anschaffungsdatum })}
        onOpen={onOpenInventar}
        onAdd={onAddInventar}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.KATEGORIEN} recordId={record.record_id} />
    </>
  );
}
