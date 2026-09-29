export const GROUPS = [
  { title: 'Morgen · Schlaf & körperlicher Start', items: [
    ['sleepQuality','Schlechte Schlafqualität'],['morningFatigue','Morgendliche Erschöpfung'],['bodyTension','Körperliche Anspannung'],['pmsPhysical','Körperliche PMS-Symptome']
  ]},
  { title: 'Tagsüber · Ernährung', positive: true, items: [
    ['hydrationAdequacy','Gefühlt genug getrunken'],['mealRegularity','Regelmäßig / ausreichend gegessen'],['protein','Proteinmenge'],['fiber','Ballaststoffmenge'],['carbs','Kohlenhydratmenge'],['sugar','Zucker / Süßes'],['vegetables','Gemüse'],['wholeFoods','Vollwertige / wenig verarbeitete Lebensmittel']
  ]},
  { title: 'Tagsüber · Aufmerksamkeit & Aktivität', items: [
    ['distractibility','Ablenkbarkeit'],['concentration','Konzentrationsprobleme'],['taskStart','Aufgaben beginnen schwierig'],['taskFinish','Aufgaben abschließen schwierig'],['switching','Wechseln / Stoppen schwierig'],['impulsivity','Impulsivität / innere Unruhe'],['hyperfocus','Hyperfokus']
  ]},
  { title: 'Tagsüber · Reize, Soziales & Veränderungen', items: [
    ['sensory','Sensorische Überlastung'],['socialEffort','Soziale Anstrengung'],['masking','Bewusstes Anpassen / Masking'],['socialInterpretation','Schwierigkeit, andere zu interpretieren'],['routineNeed','Bedürfnis nach Routine / Vorhersehbarkeit'],['changeStress','Belastung durch Planänderungen'],['withdrawal','Rückzugsbedürfnis'],['shutdown','Shutdown / Meltdown']
  ]},
  { title: 'Emotionen & Stresssystem', items: [
    ['depressed','Niedergeschlagenheit'],['irritability','Reizbarkeit / Wut'],['anxiety','Angst / Anspannung'],['lability','Stimmungsschwankungen / Weinen'],['hopelessness','Hoffnungslosigkeit'],['lossInterest','Interessen- / Freudverlust'],['overwhelmed','Überforderungsgefühl'],['hyperarousal','Übererregung / Alarmbereitschaft'],['triggerReaction','Triggerreaktionen'],['intrusions','Intrusionen / belastende Erinnerungen'],['avoidance','Vermeidung'],['dissociation','Dissoziation / Fremdheitsgefühl'],['selfBlame','Selbstbeschuldigung']
  ]},
  { title: 'Abends · Funktionsniveau & Folgen', items: [
    ['fatigue','Erschöpfung am Tagesende'],['workImpairment','Beeinträchtigung Arbeit / Leistung'],['dailyImpairment','Beeinträchtigung Alltag / Haushalt'],['socialImpairment','Beeinträchtigung Beziehungen / Soziales'],['cravings','Appetitveränderung / Cravings']
  ]}
];

export const CONTEXTS = [
  ['trauma','Gefahr / Trauma'],['social','Soziale Unsicherheit'],['sensoryContext','Reizüberlastung'],['change','Planänderung'],['conflict','Konflikt'],['work','Arbeitsstress'],['socialLoad','Hohe soziale Belastung'],['illness','Krank / körperlich angeschlagen']
];

export const POSITIVE_KEYS = new Set(['hydrationAdequacy','mealRegularity','protein','fiber','carbs','vegetables','wholeFoods']);

export const LABELS = {
  cycleDay:'Zyklustag',daysFromOvulation:'Tage relativ zur Ovulationsmitte',daysToNextPeriod:'Tage bis nächste Menstruation',sleepHours:'Schlafstunden',waterCount:'Wasser / Saft',caffeineCount:'Koffein',alcoholCount:'Alkohol',fruitCount:'Obst',wellbeing:'Wohlbefinden',energy:'Energie'
};
for (const g of GROUPS) for (const [k,l] of g.items) LABELS[k] = l;
