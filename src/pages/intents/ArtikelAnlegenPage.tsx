/**
 * Artikel anlegen — 4-Schritt-Wizard.
 * Steps: 1) Kategorie wählen → 2) Lieferant wählen → 3) Artikeldaten eingeben → 4) Prüfen & anlegen.
 * Reads: kategorien, lieferanten. Writes: inventar (createInventarEntry).
 * Composes: IntentWizardShell, EntitySelectStep, ChoiceGroup, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldNumber } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function ArtikelAnlegenPage() {
  const [step, setStep] = useState(1);

  const kategorien = useRecordSearch(servicePort, 'kategorien', {
    searchFields: ['kategoriename'],
    toItem: k => ({
      id: k.id,
      title: fieldText(k, 'kategoriename'),
    }),
  });

  const lieferanten = useRecordSearch(servicePort, 'lieferanten', {
    searchFields: ['firmenname', 'ansprechpartner_vorname', 'ansprechpartner_nachname'],
    toItem: l => ({
      id: l.id,
      title: fieldText(l, 'firmenname'),
      subtitle: [fieldText(l, 'ansprechpartner_vorname'), fieldText(l, 'ansprechpartner_nachname')]
        .filter(Boolean)
        .join(' ') || undefined,
    }),
  });

  const artikel = useStepForm('inventar', {
    steps: {
      kategorie: 1,
      lieferant: 2,
      artikelname: 3,
      artikelnummer: 3,
      bestand: 3,
      mindestbestand: 3,
      einheit: 3,
      standort: 3,
      einkaufspreis: 3,
      zustand: 3,
      anschaffungsdatum: 3,
      notizen: 3,
    },
  });

  const submit = useJourneySubmit(
    servicePort,
    [{ key: 'inventar', entity: 'inventar', form: artikel, primary: true }],
    { draftKey: 'artikel-anlegen' },
  );

  const bestand = fieldNumber(
    { id: '', fields: artikel.values, createdAt: null },
    'bestand',
  ) ?? 0;
  const mindestbestand = fieldNumber(
    { id: '', fields: artikel.values, createdAt: null },
    'mindestbestand',
  ) ?? 0;
  const bestandWarn = mindestbestand > 0 && bestand < mindestbestand;

  return (
    <IntentWizardShell
      title={tx('Artikel anlegen')}
      subtitle={tx('Neuen Inventarartikel erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[artikel]}
      draftKey="artikel-anlegen"
      intro={{
        description: tx('Neuen Inventarartikel mit Kategorie, Lieferant und Bestand erfassen.'),
        needs: [tx('Kategoriename'), tx('Firmenname des Lieferanten'), tx('Artikelname und aktueller Bestand')],
      }}
    >
      <WizardStep
        label={tx('Kategorie')}
        description={tx('Zu welcher Kategorie gehört der neue Artikel?')}
      >
        <EntitySelectStep
          {...kategorien.select}
          selectedId={artikel.get('kategorie') as string | null}
          onSelect={id => {
            artikel.set('kategorie', id, kategorien.labelOf(id));
            setStep(2);
          }}
          searchPlaceholder={tx('Kategorie suchen …')}
          avatar="none"
        />
      </WizardStep>

      <WizardStep
        label={tx('Lieferant')}
        description={tx('Von welchem Lieferanten stammt der Artikel?')}
      >
        <EntitySelectStep
          {...lieferanten.select}
          selectedId={artikel.get('lieferant') as string | null}
          onSelect={id => {
            artikel.set('lieferant', id, lieferanten.labelOf(id));
            setStep(3);
          }}
          searchPlaceholder={tx('Lieferant suchen …')}
          avatar="initials"
        />
      </WizardStep>

      <WizardStep
        label={tx('Artikeldaten')}
        description={tx('Name, Bestand und weitere Angaben zum Artikel eingeben.')}
      >
        <div className="space-y-4">
          <Bound form={artikel} name="artikelname" />
          <Bound form={artikel} name="artikelnummer" />
          <Bound form={artikel} name="bestand" hint={tx('Aktueller Bestand bei Aufnahme (bei neuem Artikel: 0)')} />
          {bestandWarn && (
            <p className="text-xs text-destructive">
              {tx('Bestand liegt unter dem Mindestbestand — bitte prüfen.')}
            </p>
          )}
          <Bound form={artikel} name="mindestbestand" />
          <Bound form={artikel} name="einheit" />
          <Bound form={artikel} name="standort" hint={tx('z. B. Regal A3, Lager Keller')} />
          <Bound form={artikel} name="einkaufspreis" />
          <Bound form={artikel} name="zustand" />
          <Bound form={artikel} name="anschaffungsdatum" />
          <Bound form={artikel} name="notizen" rows={3} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => artikel.validate(['artikelname', 'bestand'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[artikel]}
            submit={submit}
            whatHappensNext={tx('Der Artikel erscheint sofort in der Inventarliste und kann von dort verwaltet werden.')}
            confirmLabel={tx('Artikel anlegen')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[artikel]}
          submit={submit}
          restartLabel={tx('Noch einen Artikel anlegen')}
          whatHappensNext={tx('Den Bestand kannst du jederzeit über den Ablauf „Bestand aktualisieren" anpassen.')}
          next={[
            { label: tx('Bestand aktualisieren'), href: '#/intents/bestand-aktualisieren' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
