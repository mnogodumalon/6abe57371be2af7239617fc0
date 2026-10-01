/**
 * Bestand aktualisieren — 3-Schritt-Wizard.
 * Steps: 1) Artikel wählen (inventar, Suche nach artikelname/artikelnummer) →
 *         2) Neuen Bestand eingeben (bestand, mit Warnung bei < mindestbestand) →
 *         3) Prüfen & aktualisieren (SummaryStep).
 * Reads: inventar. Writes: inventar (update — bestand).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { Input } from '@/components/ui/input';
import {
  useRecordSearch,
  useStepForm,
  useJourneySubmit,
  fieldNumber,
  fieldText,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function BestandAktualisierenPage() {
  const [step, setStep] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const artikel = useRecordSearch(servicePort, 'inventar', {
    searchFields: ['artikelname', 'artikelnummer'],
    toItem: r => ({
      id: r.id,
      title: fieldText(r, 'artikelname'),
      subtitle: tx`Bestand: ${String(fieldNumber(r, 'bestand') ?? 0)}`,
    }),
  });

  const f = useStepForm('inventar', {
    fields: ['bestand'],
    steps: { bestand: 2 },
  });

  const selectedRecord = selectedId ? artikel.recordOf(selectedId) : undefined;
  const aktuellerBestand = selectedRecord ? fieldNumber(selectedRecord, 'bestand') : null;
  const mindestbestand = selectedRecord ? fieldNumber(selectedRecord, 'mindestbestand') : null;
  const neuerBestand = f.get('bestand') !== undefined && f.get('bestand') !== '' ? Number(f.get('bestand')) : null;
  const unterMindest =
    mindestbestand !== null && neuerBestand !== null && neuerBestand < mindestbestand;

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'update',
        entity: 'inventar',
        form: f,
        updates: selectedId ?? '',
        primary: true,
        verb: 'update',
      },
    ],
    { draftKey: 'bestand-aktualisieren' },
  );

  return (
    <IntentWizardShell
      title={tx('Bestand aktualisieren')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="bestand-aktualisieren"
      intro={{
        description: tx('Den Lagerbestand eines Inventarartikels korrigieren oder nachfüllen.'),
        needs: [tx('Artikelname oder Artikelnummer')],
      }}
    >
      <WizardStep
        label={tx('Artikel wählen')}
        description={tx('Suche nach Artikelname oder Artikelnummer und wähle den Artikel aus.')}
      >
        <EntitySelectStep
          {...artikel.select}
          avatar="none"
          selectedId={selectedId ?? undefined}
          onSelect={id => {
            setSelectedId(id);
            setStep(2);
          }}
          searchPlaceholder={tx('Artikelname oder Artikelnummer ...')}
          create={false}
        />
      </WizardStep>

      <WizardStep
        label={tx('Bestand')}
        description={tx('Aktuellen Bestand prüfen und neuen Bestand eingeben.')}

      >
        {selectedRecord && (
          <div className="space-y-5">
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                {fieldText(selectedRecord, 'artikelname')}
              </p>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <span>
                  {tx('Aktueller Bestand')}:{' '}
                  <span className="font-semibold text-foreground">
                    {aktuellerBestand ?? 0}
                  </span>
                </span>
                {mindestbestand !== null && (
                  <span>
                    {tx('Mindestbestand')}:{' '}
                    <span className="font-semibold text-foreground">{mindestbestand}</span>
                  </span>
                )}
              </div>
            </div>

            <Field form={f} name="bestand" hint={tx('Neuer Gesamtbestand — nicht die Differenz')}>
              <Input {...f.number('bestand')} placeholder="0" />
            </Field>

            {unterMindest && mindestbestand !== null && (
              <p className="text-sm text-destructive">
                {tx`Achtung: Bestand liegt unter dem Mindestbestand von ${String(mindestbestand)}`}
              </p>
            )}

            <StepNav
              onBack={() => setStep(1)}
              onNext={() => f.validate(['bestand'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}
        {!selectedRecord && (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            items={[
              {
                key: '_artikel',
                label: tx('Artikel'),
                value: selectedRecord ? fieldText(selectedRecord, 'artikelname') : '—',
              },
              {
                key: '_alterBestand',
                label: tx('Alter Bestand'),
                value: aktuellerBestand !== null ? String(aktuellerBestand) : '—',
              },
            ]}
            whatHappensNext={tx('Der Bestand wird sofort im System aktualisiert.')}
            confirmLabel={tx('Bestand aktualisieren')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          verb="updated"
          forms={[f]}
          facts={[
            {
              label: tx('Artikel'),
              value: selectedRecord ? fieldText(selectedRecord, 'artikelname') : '—',
            },
            {
              label: tx('Neuer Bestand'),
              value: neuerBestand !== null ? String(neuerBestand) : '—',
            },
          ]}
          next={[
            {
              label: tx('Weiteren Artikel aktualisieren'),
              onClick: () => {
                submit.reset();
                f.reset();
                setSelectedId(null);
                setStep(1);
              },
            },
            { label: tx('Neuen Artikel anlegen'), href: '#/intents/artikel-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Der neue Bestand ist ab sofort im Inventar sichtbar.')}
        />
      )}
    </IntentWizardShell>
  );
}
