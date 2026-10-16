import { FLAGS, GSS, SOURCES } from "./site";

export interface ArticleSection {
  id: string;
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  intro: string;
  category: string;
  /** ISO 8601 publication timestamp with timezone; never regenerated at build time. */
  published: string;
  updated: string;
  sections: readonly ArticleSection[];
  faq: readonly { question: string; answer: string }[];
  sources: readonly { label: string; url: string }[];
  relatedSlugs: readonly string[];
}

const TRIAL_TERMS = FLAGS.FREE_TRIAL
  ? "probni trening je besplatan"
  : "probni trening se zakazuje uz prethodni dogovor";

const WOMENS_ARTISTIC_SOURCE = {
  label: "World Gymnastics: sprave ženske sportske gimnastike",
  url: "https://www.gymnastics.sport/site/pages/disciplines/app-wag.php",
};
const AEROBIC_SOURCE = {
  label: "World Gymnastics: šta je aerobna gimnastika",
  url: "https://www.gymnastics.sport/site/pages/disciplines/aer-presentation.php",
};
const GSS_ARTISTIC_SOURCE = {
  label: "Gimnastički savez Srbije: ženska sportska gimnastika i programi",
  url: "https://www.gssrb.rs/zenska-sportska-gimnastika/",
};
const CLUB_SOURCE = { label: "GSU „Kraguj“ u imeniku Gimnastičkog saveza Srbije", url: GSS.clubPage };
const COACH_SOURCE = { label: "GSS: registrovane trenerice ženske sportske gimnastike, septembar 2026.", url: SOURCES.coachLicences };

/**
 * Editorial content maintained with the website, independently of Outrank.
 * Club facts: content/site.ts, content/programs.ts, content/schedule.ts and docs/dosije.md.
 * Author/publisher: GSU „Kraguj“. Publication does not imply a coach reviewed these drafts.
 * General practical guidance is editorial advice, not medical or individualized training advice.
 */
// Vercel READY time of first native release (13920f8, dpl_Ba9BpsGc6cUAA2sZyAP3qYByrczt).
const FIRST_NATIVE_PUBLICATION = "2026-10-16T13:26:23.300Z";

export const ARTICLES: readonly Article[] = [
  {
    slug: "sportska-gimnastika",
    title: "Sportska gimnastika za decu: od prvog treninga do takmičenja",
    description: "Šta je sportska gimnastika, koje grupe postoje u Kraguju i kako izabrati prvi trening za dete od 3 godine ili starijeg početnika.",
    intro: "Sportska gimnastika obuhvata vežbe na parteru i spravama. Za dete koje tek počinje, prvi korak je početna grupa primerena uzrastu i iskustvu. U Kraguju u Kragujevcu postoje početne grupe od 3. godine, kao i posebne takmičarske grupe za devojčice.",
    category: "Vodič za roditelje",
    // Original URL publication from the archived Outrank RSS, retained after migration.
    published: "2026-10-16T13:05:53Z",
    updated: FIRST_NATIVE_PUBLICATION,
    sections: [
      {
        id: "sta-je-sportska-gimnastika",
        heading: "Šta podrazumeva sportska gimnastika?",
        paragraphs: [
          "U ženskoj sportskoj gimnastici takmiči se na četiri sprave: preskoku, dvovisinskom razboju, gredi i parteru. Svaka ima svoje zahteve: od odraza i doskoka do njihanja, ravnoteže i povezivanja pokreta. To je opis discipline; početnik ne radi odmah ono što gledate na velikim takmičenjima.",
          "Kada birate trening za dete, korisnije je da pitate šta obuhvata početni program nego kada će dete izvesti određeni težak element. U Kraguju je mlađa početna grupa predstavljena kroz igru, koordinaciju, ravnotežu i gipkost, a starija kroz osnovne elemente na parteru i spravama. Konkretne zadatke određuje trenerica.",
        ],
      },
      {
        id: "uzrast-i-prvi-koraci",
        heading: "Od koliko godina dete može da počne?",
        paragraphs: [
          "U Kraguju mlađa početna grupa obuhvata uzrast od 3 do 8 godina, dok je starija početna namenjena deci od 8 godina koja tek počinju. Ako dete ima osam godina, uzrast se poklapa u opisima dve grupe: pri zakazivanju recite koliko ima godina i da li je ranije treniralo, pa dogovorite odgovarajući dolazak.",
          "Postojanje starije početne grupe važno je za porodice koje se prvi put raspituju tek po polasku deteta u školu. Dete ne mora da se prijavi u takmičarsku grupu samo zato što više nije predškolac. Prethodno iskustvo iz drugog sporta takođe opišite trenerici, bez pretpostavke da ono automatski određuje gimnastički nivo.",
        ],
      },
      {
        id: "pocetne-i-takmicarske-grupe",
        heading: "Početna grupa i takmičarski program nisu ista odluka",
        paragraphs: [
          "Kraguj ima početne grupe, takmičarske grupe C programa i grupu A i B programa ženske sportske gimnastike. Oznake programa odnose se na sistem takmičenja Gimnastičkog saveza Srbije. Roditelj ne treba samostalno da bira slovo programa prema uzrastu ili ambiciji; o odgovarajućoj grupi razgovara se sa trenericom.",
          "Razlikuje se i raspored. Početne grupe imaju termine ponedeljkom, sredom i petkom: mlađa od 18:00 do 19:00, a starija od 19:00 do 20:00. A i B grupa ima treninge pet dana u nedelji. Pre prelaska u drugi program proverite celu nedelju, trajanje treninga i obaveze koje dolaze uz eventualni takmičarski nastup.",
        ],
      },
      {
        id: "kako-proceniti-prvi-trening",
        heading: "Šta da pratite tokom prvog susreta sa klubom?",
        paragraphs: [
          "Probni trening koristite da upoznate ljude, prostor i način komunikacije. Pre dolaska pitajte kako se organizuje prvi susret i gde roditelj može da sačeka. Nakon treninga pitajte dete šta mu je bilo zanimljivo, šta mu nije bilo jasno i da li želi ponovo da dođe. To daje konkretniju sliku od pitanja da li je bilo najbolje u grupi.",
          "Sa trenericom razjasnite kojoj grupi dete pripada i šta je sledeći korak ako želi da nastavi. Ako dete neki zadatak nije razumelo, opišite tu situaciju. Nemojte prvi trening pretvarati u proveru talenta ili obećanje budućih medalja: za izbor je važan i svakodnevni odlazak na trening, odnos sa grupom i interesovanje deteta.",
        ],
      },
      {
        id: "sportska-gimnastika-kragujevac",
        heading: "Kako početi u Kraguju u Kragujevcu?",
        paragraphs: [
          `Treninzi se održavaju u sali Trgovinsko-ugostiteljske škole „Toza Dragović“, Save Kovačevića 25, poznate u gradu kao „ŠUP“. Upis je moguć tokom cele godine, a ${TRIAL_TERMS}. Javite se unapred na 060 028 7631 ili 061 422 4386 kako biste dogovorili grupu i termin.`,
          "Za prvi dolazak klub navodi helanke, majicu, čarape i flašicu vode; odeća treba da bude uska, a kosa vezana. Sa decom rade Slađana Kovačević i Ivana Kovačević, licencirane trenerice sportske gimnastike. Iznos članarine nije objavljen, pa ga proverite direktno pre odluke o nastavku.",
        ],
      },
    ],
    faq: [
      { question: "Da li dete mora ranije da trenira da bi počelo gimnastiku?", answer: "Kraguj ima početne grupe za decu od 3 do 8 godina i za početnike od 8 godina. Pri dogovoru navedite uzrast i prethodno iskustvo deteta." },
      { question: "Koje su sprave u ženskoj sportskoj gimnastici?", answer: "Preskok, dvovisinski razboj, greda i parter. Početni trening prilagođava se grupi; ne podrazumeva izvođenje takmičarskih elemenata sa prvog susreta." },
      { question: "Da li upis u početnu grupu znači i prijavu za takmičenje?", answer: "Početne i takmičarske grupe imaju odvojene programe i rasporede. O eventualnom takmičarskom putu razgovarajte sa trenericom." },
    ],
    sources: [WOMENS_ARTISTIC_SOURCE, GSS_ARTISTIC_SOURCE, CLUB_SOURCE, COACH_SOURCE],
    relatedSlugs: ["prvi-trening-gimnastike-za-decu", "sportska-i-aerobna-gimnastika"],
  },
  {
    slug: "prvi-trening-gimnastike-za-decu",
    title: "Prvi trening gimnastike za decu: priprema i dolazak u Kraguj",
    description: "Šta poneti na prvi trening gimnastike, kako dogovoriti probni termin u Kragujevcu i koja pitanja postaviti pre upisa u Kraguj.",
    intro: `Za prvi trening gimnastike u Kraguju najpre se javite telefonom ili porukom. Klub prima članove tokom cele godine, a ${TRIAL_TERMS}. Ponesite helanke, majicu, čarape i vodu, vežite detetu kosu i dođite u dogovoreni termin u školu „Toza Dragović“ u Kragujevcu.`,
    category: "Prvi trening",
    published: FIRST_NATIVE_PUBLICATION,
    updated: FIRST_NATIVE_PUBLICATION,
    sections: [
      {
        id: "dogovor-pre-dolaska",
        heading: "Prvo dogovorite grupu i termin",
        paragraphs: [
          "Pozovite 060 028 7631 ili 061 422 4386 i navedite uzrast deteta, da li je ranije treniralo gimnastiku i da želite probni trening. Ako šaljete poruku, te tri informacije su dobar početak. Dolazak unapred dogovorite i kada ste na sajtu već pronašli raspored, kako biste potvrdili odgovarajuću grupu.",
          "Mlađa početna grupa, od 3 do 8 godina, trenira ponedeljkom, sredom i petkom od 18:00 do 19:00. Starija početna grupa, od 8 godina, istim danima ima termine od 19:00 do 20:00. Za dete od osam godina pitajte koja grupa odgovara njegovom iskustvu; oba opisa obuhvataju taj uzrast.",
        ],
      },
      {
        id: "sta-poneti",
        heading: "Šta poneti na prvi trening?",
        paragraphs: [
          "Klub je za prvi trening naveo jednostavnu opremu koju pripremate pre polaska. Takmičarke koriste klupsku opremu i trikoe, ali za probni dolazak sledite uputstvo za početnike. Ako niste sigurni da li odeća koju imate odgovara, proverite sa trenericom pre kupovine.",
        ],
        bullets: [
          "Helanke i majicu: odeća treba da bude uska.",
          "Čarape, prema uputstvu kluba za prvi dolazak.",
          "Flašicu vode koju dete prepoznaje kao svoju.",
          "Vezanu kosu, pripremljenu pre početka treninga.",
        ],
      },
      {
        id: "gde-doci",
        heading: "Gde se dolazi na trening?",
        paragraphs: [
          "Sala je u Trgovinsko-ugostiteljskoj školi „Toza Dragović“, na adresi Save Kovačevića 25 u Kragujevcu. Lokalni naziv „ŠUP“ može pomoći pri snalaženju, ali za mapu koristite pun naziv škole i adresu. Pri prvom dogovoru pitajte gde je ulaz u salu i gde treba da se javite.",
          "U imeniku Gimnastičkog saveza Srbije uz klub je navedena druga adresa, Cara Dušana 21. Za trening koristite adresu škole koju klub objavljuje za dolazak. Nemojte pretpostaviti da adresa iz sportskog imenika istovremeno označava mesto na kom se održava početna grupa.",
        ],
      },
      {
        id: "priprema-deteta",
        heading: "Kako detetu objasniti prvi dolazak?",
        paragraphs: [
          "Objasnite jednostavno: ide da upozna salu, trenericu i grupu i da proba gimnastiku. Nije potrebno obećavati da će odmah naučiti zvezdu, špagu ili neki drugi element. Prvi dolazak je upoznavanje sa novim okruženjem, a sadržaj i redosled zadataka vodi trenerica.",
          "Pre polaska saslušajte šta dete želi da zna. Možda ga zanima ko će biti u grupi, gde ćete Vi biti ili šta ako ne razume zadatak. Pitanja na koja nemate odgovor prenesite trenerici. Organizaciju čekanja roditelja dogovorite sa klubom, jer ona nije navedena u javnom rasporedu.",
        ],
      },
      {
        id: "razgovor-posle-treninga",
        heading: "Šta pitati posle probnog treninga?",
        paragraphs: [
          "Najpre pitajte dete šta je radilo i kako mu je bilo. Dajte mu prostora da opiše i ono što mu se dopalo i ono što mu je bilo neobično. Korisno je da saznate da li želi ponovo da dođe, a zatim sa trenericom proverite izbor grupe i način nastavka.",
          "Kada razmišljate o upisu, razjasnite i praktične uslove. Cena članarine nije javno navedena. Pitajte za iznos, način plaćanja, potrebne podatke za učlanjenje i eventualnu dokumentaciju. Uslovi probnog treninga ne daju odgovor na troškove redovnog članstva ili budućih takmičarskih aktivnosti.",
        ],
      },
      {
        id: "kratak-plan",
        heading: "Kratak plan za roditelja",
        paragraphs: [
          "Pre dolaska imate tri zadatka: dogovoriti odgovarajuću grupu, pripremiti opremu i proveriti put do sale. Posle treninga odluku oslonite na razgovor sa detetom i trenericom, uz raspored koji porodica može redovno da prati. Za početak nisu potrebni obećanje o takmičenjima ni poređenje sa decom koja već treniraju.",
        ],
      },
    ],
    faq: [
      {
        question: FLAGS.FREE_TRIAL ? "Da li je probni trening u Kraguju besplatan?" : "Kako se zakazuje probni trening u Kraguju?",
        answer: FLAGS.FREE_TRIAL
          ? "Da. Probni trening je besplatan. Javite se klubu unapred da dogovorite grupu i dolazak."
          : "Javite se klubu unapred da dogovorite grupu i dolazak i proverite aktuelne uslove probnog treninga.",
      },
      { question: "Da li za prvi trening treba kupiti triko?", answer: "Uputstvo kluba za prvi trening navodi helanke, majicu, čarape, vezanu kosu i flašicu vode. Za svaku dodatnu kupovinu prvo pitajte trenericu." },
      { question: "Da li se na prvi trening dolazi na adresu iz GSS imenika?", answer: "Na trening se dolazi u salu škole „Toza Dragović“, Save Kovačevića 25, Kragujevac. Pre prvog dolaska potvrdite detalje sa klubom." },
    ],
    sources: [
      CLUB_SOURCE,
      { label: "Trgovinsko-ugostiteljska škola „Toza Dragović“: kontakt i adresa", url: "https://www.tozadragovic.edu.rs/kontakt/" },
    ],
    relatedSlugs: ["sportska-gimnastika", "sportska-i-aerobna-gimnastika"],
  },
  {
    slug: "sportska-i-aerobna-gimnastika",
    title: "Sportska i aerobna gimnastika: razlike i izbor programa",
    description: "Uporedite sportsku i aerobnu gimnastiku, ulogu sprava i muzike, početne grupe i termine koje nudi Kraguj u Kragujevcu.",
    intro: "Sportska i aerobna gimnastika su različite discipline. Ženska sportska gimnastika obuhvata četiri sprave, dok aerobna povezuje pokret i gimnastičke elemente u koreografiju uz muziku. U Kraguju postoje oba programa; odgovarajuću grupu i mogućnost početka dogovorite sa trenericom.",
    category: "Programi gimnastike",
    published: FIRST_NATIVE_PUBLICATION,
    updated: FIRST_NATIVE_PUBLICATION,
    sections: [
      {
        id: "glavna-razlika",
        heading: "U čemu je glavna razlika?",
        paragraphs: [
          "U ženskoj sportskoj gimnastici nastupa se na preskoku, dvovisinskom razboju, gredi i parteru. U aerobnoj gimnastici u središtu je povezana koreografija uz muziku, sa aerobnim koracima i gimnastičkim elementima. Razlika zato nije samo u tome da li na treningu čujete muziku: i ženski parter ima muzičku pratnju.",
          "Opis discipline pomaže da razumete šta gledate, ali ne govori sam po sebi kako izgleda početni trening Vašeg deteta. Za to su važni uzrast, iskustvo, konkretna grupa i plan trenerice. Snimak takmičenja može da pokaže izgled gotovog nastupa; ne predstavlja spisak veština koje početnik već mora da ima.",
        ],
      },
      {
        id: "sportska-u-kraguju",
        heading: "Kako je sportska gimnastika organizovana u Kraguju?",
        paragraphs: [
          "Za prve korake postoje mlađa početna grupa od 3 do 8 godina i starija početna od 8 godina. Mlađa trenira ponedeljkom, sredom i petkom od 18:00 do 19:00, a starija istim danima od 19:00 do 20:00. Ako se uzrasti preklapaju ili dete već ima iskustva, izbor grupe proverite sa klubom.",
          "Kraguj ima i takmičarke u C programu i grupu A i B programa ženske sportske gimnastike. To su odvojene grupe sa sopstvenim rasporedom. Slova programa nemojte tumačiti kao ponudu iz koje roditelj sam bira nivo: uslovi i put napredovanja razjašnjavaju se sa trenericom u okviru pravila takmičenja.",
        ],
      },
      {
        id: "aerobna-u-kraguju",
        heading: "Šta obuhvata aerobna gimnastika u klubu?",
        paragraphs: [
          "Klub opisuje aerobnu gimnastiku kroz muziku, koreografiju, skokove, snagu i izdržljivost. Termin je ponedeljkom, sredom i petkom od 20:00 do 21:30. Kraguj učestvuje i na takmičenjima aerobne gimnastike; to potvrđuje bilten Prvenstva Srbije održanog u Rumi 13. decembra 2025. godine.",
          "Za aerobnu grupu nije objavljena posebna starosna granica. Zato se za ovaj program ne treba voditi uzrastom mlađe ili starije početne grupe sportske gimnastike. Pri javljanju recite godine deteta, prethodno iskustvo i da Vas zanima baš aerobna gimnastika, pa pitajte o mogućnosti priključivanja i probnom dolasku.",
        ],
      },
      {
        id: "kako-razgovarati-o-izboru",
        heading: "Kako izabrati bez nagađanja o talentu?",
        paragraphs: [
          "Počnite od interesovanja deteta. Da li najviše priča o spravama, ravnoteži, pokretima uz muziku ili zajedničkom nastupu? Odgovor može da usmeri razgovor, ali nije procena sposobnosti. Trenerici objasnite šta dete privlači i zatražite objašnjenje odgovarajućeg početka.",
          "Izbor zavisi i od porodičnog rasporeda. Uporedite vreme polaska, povratka kući i mogućnost redovnog dolaska tokom školske nedelje. Večernji termin aerobne grupe traje do 21:30, dok početne grupe sportske gimnastike završavaju ranije. To je konkretna razlika koju vredi razmotriti pre upisa.",
          "Pitajte i šta je sledeći korak ako dete posle probnog treninga želi da nastavi. Nemojte pretpostaviti da je promena programa automatska, da su sve grupe početničke ili da ulazak u klub obavezno uključuje takmičenja. Dogovor o grupi treba da bude jasan pre redovnog dolaska.",
        ],
      },
      {
        id: "ista-adresa-prvi-korak",
        heading: "Gde se raspitati i doći na probni trening?",
        paragraphs: [
          `Treninzi Kraguja održavaju se u Kragujevcu, u sali Trgovinsko-ugostiteljske škole „Toza Dragović“, Save Kovačevića 25. Za dogovor pozovite 060 028 7631 ili 061 422 4386. Upis je otvoren tokom cele godine, a ${TRIAL_TERMS}; pri dogovoru navedite koji program Vas zanima.`,
          "U klubu rade licencirane trenerice sportske gimnastike Slađana Kovačević i Ivana Kovačević. Na prvom razgovoru proverite kome se obraćate za izabrani program, potrebnu opremu i aktuelne uslove članstva. Ta pitanja daju korisniju osnovu za odluku nego opšta tvrdnja da je jedna disciplina bolja za svako dete.",
        ],
      },
    ],
    faq: [
      { question: "Da li se samo aerobna gimnastika radi uz muziku?", answer: "Ne. Muzika ima važnu ulogu u aerobnoj gimnastici, a ženski parter u sportskoj gimnastici takođe ima muzičku pratnju. Discipline se razlikuju po sadržaju i pravilima." },
      { question: "Od koliko godina se upisuje aerobna gimnastika u Kraguju?", answer: "Za aerobnu grupu nije javno navedena posebna starosna granica. Pozovite klub i navedite uzrast i iskustvo deteta da biste proverili mogućnost početka." },
      { question: "Kada su treninzi aerobne gimnastike u Kraguju?", answer: "Ponedeljkom, sredom i petkom od 20:00 do 21:30, u sali škole „Toza Dragović“ u Kragujevcu. Prvi dolazak dogovorite unapred." },
    ],
    sources: [
      WOMENS_ARTISTIC_SOURCE,
      AEROBIC_SOURCE,
      GSS_ARTISTIC_SOURCE,
      { label: "GSS: aerobna gimnastika", url: "https://www.gssrb.rs/aerobna-gimnastika/" },
      { label: "GSS: bilten Prvenstva Srbije u aerobnoj gimnastici 2025.", url: SOURCES.bulletin2025Aer },
    ],
    relatedSlugs: ["sportska-gimnastika", "prvi-trening-gimnastike-za-decu"],
  },
  {
    slug: "kako-izabrati-gimnasticki-klub-u-srbiji",
    title: "Kako izabrati gimnastički klub u Srbiji: pitanja za roditelje",
    description: "Praktična pitanja za izbor gimnastičkog kluba u Srbiji: disciplina, treneri, početne grupe, raspored, probni trening i uslovi članstva.",
    intro: "Gimnastički klub birajte prema programu koji odgovara detetu, ljudima koji vode trening i uslovima koje porodica može redovno da prati. Proverite disciplinu, uzrast početne grupe, trenerske licence, mesto treninga i cenu članstva. Ovaj vodič daje pitanja za izbor bilo gde u Srbiji; Kraguj trenira u Kragujevcu.",
    category: "Vodič za roditelje",
    published: FIRST_NATIVE_PUBLICATION,
    updated: FIRST_NATIVE_PUBLICATION,
    sections: [
      {
        id: "prvo-disciplina",
        heading: "1. Proverite koju gimnastiku klub nudi",
        paragraphs: [
          "Naziv „gimnastika za decu“ ne opisuje uvek isti program. Gimnastički savez Srbije u imeniku razlikuje mušku i žensku sportsku gimnastiku, ritmičku gimnastiku, trampolinu i aerobnu gimnastiku. Najpre pitajte koji program klub zaista organizuje i da li postoji odgovarajuća početna grupa za Vaše dete.",
          "Zatim razdvojite početno vežbanje od takmičarske ponude. Klub može da ima takmičarske rezultate, a da u određenom trenutku nema slobodno mesto u grupi koja Vama treba. U prvom razgovoru navedite uzrast, iskustvo i da li tek upoznajete sport, umesto da zaključujete prema fotografijama medalja.",
        ],
      },
      {
        id: "provera-kluba-i-trenera",
        heading: "2. Proverite klub i ljude koji vode trening",
        paragraphs: [
          "Zvanični imenik Gimnastičkog saveza Srbije koristan je početak za proveru naziva kluba i kontakta. Za trenera tražite ime, disciplinu za koju vodi rad i podatak o važećoj dozvoli za rad. GSS objavljuje registracije i liste trenera po disciplinama, pa je bolje proveriti konkretno ime nego se osloniti na opšti opis „stručan tim“.",
          "Imenik ne daje sve informacije za upis. Proverite direktno ko vodi grupu, na kojoj adresi se vežba i kome se obraćate za pitanja. U Kraguju su Slađana Kovačević i Ivana Kovačević navedene u GSS listi registrovanih trenerica ženske sportske gimnastike iz septembra 2026. To je proverljiv podatak o licencama, a ne obećanje određenog rezultata za svako dete.",
        ],
      },
      {
        id: "pitanja-o-radu",
        heading: "3. Pitajte kako se organizuje početna grupa",
        paragraphs: [
          "Tražite konkretno objašnjenje prvog dolaska: kojoj grupi se dete priključuje, ko ga dočekuje i kako se roditelj obaveštava o nastavku. Na probnom susretu obratite pažnju na to da li možete da dobijete razumljiv odgovor o programu i svakodnevnoj organizaciji. Spisak sprava sam po sebi nije dovoljno objašnjenje treninga.",
          "Korisno je da pre dolaska razjasnite i pravila komunikacije. Pitajte kome se javljaju izostanci, kako saznajete za promenu termina i gde roditelj čeka tokom treninga. To su pitanja koja možete postaviti svakom klubu, bez obzira na grad ili takmičarske ambicije.",
        ],
        bullets: [
          "Koji uzrast i nivo iskustva obuhvata početna grupa?",
          "Ko vodi trening i kako se bira odgovarajuća grupa?",
          "Šta dete treba da ponese na probni dolazak?",
          "Kako dobijamo obaveštenja i kome postavljamo pitanja?",
        ],
      },
      {
        id: "raspored-i-troskovi",
        heading: "4. Uporedite celu nedelju i uslove članstva",
        paragraphs: [
          "Zabeležite dane, početak i kraj treninga, pa dodajte vreme putovanja. Raspored koji deluje izvodljivo jednom može biti zahtevan kada postane redovna obaveza. Proverite da li vreme zavisi od školske smene i da li se početne i takmičarske grupe razlikuju po broju dolazaka.",
          "Pre upisa tražite jasan iznos članarine i pitajte šta on obuhvata. Posebno proverite eventualne troškove opreme i takmičarskih aktivnosti, kao i uslove probnog treninga. Nemojte prenositi cenu jednog kluba na drugi ili zaključiti da uslovi probnog dolaska važe i za ostale aktivnosti.",
        ],
      },
      {
        id: "primer-kragujevac",
        heading: "5. Primer provere: Kraguj u Kragujevcu",
        paragraphs: [
          `Kraguj ima mlađu početnu grupu od 3 do 8 godina, stariju početnu od 8 godina, takmičarske grupe ženske sportske gimnastike i aerobnu gimnastiku. Upis je otvoren tokom cele godine, a ${TRIAL_TERMS}. Članarina nije javno objavljena, pa iznos i uslove proverite direktno.`,
          "Klub trenira u sali škole „Toza Dragović“, Save Kovačevića 25, u Kragujevcu. Ta lokacija je važna pri planiranju dolaska; ovaj vodič ne predstavlja ponudu treninga Kraguja u drugim gradovima. Za probni termin i izbor grupe možete se javiti na 060 028 7631 ili 061 422 4386.",
          "Posle razgovora sa klubom i probnog dolaska uporedite ono što ste saznali sa potrebama deteta i porodice. Odluka je jasnija kada znate program, osobu koja vodi grupu, mesto, raspored i uslove članstva — i kada dete može svojim rečima da opiše prvi utisak.",
        ],
      },
    ],
    faq: [
      { question: "Gde mogu da proverim gimnastičke klubove u Srbiji?", answer: "Gimnastički savez Srbije ima zvanični imenik klubova. On je polazna tačka; aktuelnu ponudu programa, mesto treninga i slobodna mesta proverite direktno sa klubom." },
      { question: "Da li je članstvo u Savezu dovoljno za izbor kluba?", answer: "Uz proveru kluba i trenerskih licenci, razjasnite program za uzrast deteta, organizaciju treninga, raspored, opremu i uslove članstva. Probni susret pomaže da upoznate grupu." },
      { question: "Da li Kraguj ima treninge u drugim gradovima Srbije?", answer: "Ovde navedena ponuda Kraguja odnosi se na Kragujevac, na salu škole „Toza Dragović“, Save Kovačevića 25. Vodič za izbor kluba može da se koristi i u drugim gradovima." },
    ],
    sources: [
      { label: "Gimnastički savez Srbije: zvanični imenik klubova", url: "https://www.gssrb.rs/klubovi-gss/" },
      { label: "Gimnastički savez Srbije: registracija trenera", url: "https://www.gssrb.rs/registracija-trenera/" },
      GSS_ARTISTIC_SOURCE,
      COACH_SOURCE,
      CLUB_SOURCE,
    ],
    relatedSlugs: ["sportska-gimnastika", "prvi-trening-gimnastike-za-decu", "sportska-i-aerobna-gimnastika"],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}
