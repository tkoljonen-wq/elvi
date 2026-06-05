# Elvi — puheen litterointi kuurolle henkilölle

Vaiheittainen toteutussuunnitelma. Sovellus välittää kuulevan henkilön puheen
tekstinä kuuron henkilön näytölle. Puheentunnistus tehdään **Azure Speech
SDK:lla** (ei Chromen Web Speech API:lla, koska se katkeilee jatkuvassa
sanelussa).

---

## Vaiheistus (tärkeä periaate)

Rakennetaan riskialtein osa ensin ja todennetaan se ennen muuta.

| Vaihe | Sisältö | Tavoite |
|------|---------|---------|
| **1. Litterointikokeilu** | Vain puhujan näkymä. Litteroi puhe omalle näytölle. Ei Firebasea, ei QR:ää, ei toista laitetta. | **Varmistetaan että Azure-tunnistus toimii suomeksi luotettavasti ja vakaasti.** |
| 2. Tekstin siirto | Lisätään Firebase + kuuron lukijanäkymä + istunnon luonti + QR-koodi. | Teksti siirtyy puhelimelta tabletille reaaliaikaisesti. |
| 3. Viimeistely | PWA-asennus, fonttikoko, tyhjennys, käsinkirjoitus, istunnon vanheneminen, token-palvelin avaimelle. | Käyttövalmis MVP. |

**Emme etene vaiheeseen 2 ennen kuin vaihe 1 on todistetusti kunnossa.**

---

## VAIHE 1 — Litterointikokeilu (rakennetaan ensin)

### Mitä tähän tulee

Yksi HTML-sivu, joka:

- pyytää mikrofoniluvan
- kuuntelee jatkuvasti Azure Speech SDK:lla, kieli `fi-FI`
- näyttää **keskeneräisen** tunnistuksen himmeänä (Azuren `recognizing`-tapahtuma)
- näyttää **valmiit lauseet** kirkkaana, kertyvänä listana (Azuren `recognized`-tapahtuma)
- painikkeet: **Aloita** / **Lopeta** / **Tyhjennä**
- näyttää tilan (kuuntelee / pysäytetty / virhe)

Ei Firebasea. Ei toista laitetta. Tarkoitus on vain katsoa silmillä,
toimiiko suomenkielinen litterointi tarpeeksi hyvin.

### Miksi Azure SDK eikä Web Speech API

Azuren SDK hoitaa **pitkäkestoisen tunnistusistunnon itse**
(`startContinuousRecognitionAsync`). Ei manuaalista uudelleenkäynnistystä,
ei sanahukkaa katkojen välissä. Juuri tämä korjaa aiemmista projekteista
tutun katkeiluongelman.

Kaksi keskeistä tapahtumaa:

- `recognizing` → keskeneräinen teksti (päivittyy nopeasti, näytä himmeänä)
- `recognized` → valmis lause (lisää pysyvään listaan)

### Tekninen rakenne (vaihe 1)

```text
/elvi
  index.html      ← koko kokeilu yhdessä tiedostossa (helpoin aloittaa)
```

Aluksi **yksi tiedosto riittää**: HTML + CSS + JS samassa. Azure SDK ladataan
CDN:stä, ei build-vaihetta, ei npm:ää. Jaetaan myöhemmin tiedostoihin kun
siirrytään vaiheeseen 2.

### Miten testaan puhelimella

Mikrofoni vaatii **HTTPS**-yhteyden (tai `localhost`). Android-puhelimen Chromessa
testaaminen tarkoittaa, että sivu pitää olla HTTPS:n takana. Helpoin tapa:

1. Laita `index.html` GitHub Pagesiin (antaa HTTPS:n ilmaiseksi).
2. Avaa osoite puhelimen Chromessa.
3. Salli mikrofoni.
4. Puhu ja katso, näkyykö teksti.

> **Avaimen turvallisuus vaiheessa 1:** kokeilussa Azure-avain on suoraan
> koodissa. Tämä on OK *väliaikaiseen testiin*, koska:
> - käytät ilmaista F0-tasoa (ei kustannusriskiä)
> - voit luoda avaimen uudelleen (regenerate) testin jälkeen yhdellä klikkauksella
>
> Vaiheessa 3 avain siirretään pieneen token-palveluun, jolloin sitä ei
> näytetä selaimessa. Älä jätä julkista sivua pystyyn kovakoodatulla avaimella
> pitkäksi aikaa.

### Vaiheen 1 hyväksymiskriteerit

Vaihe 1 on valmis ja voimme edetä, kun:

- [ ] Litterointi käynnistyy ja pysähtyy painikkeista
- [ ] Suomenkielinen puhe muuttuu tekstiksi näytöllä
- [ ] Tunnistus **jatkuu katkeamatta** vähintään 5 minuuttia yhtäjaksoista puhetta
- [ ] Puhetauot eivät katkaise istuntoa (toisin kuin Web Speech API:lla)
- [ ] Keskeneräinen ja valmis teksti erottuvat toisistaan
- [ ] Tarkkuus on riittävä normaalille puheelle (arvioidaan käytännössä)

Jos jokin näistä pettää, korjataan se ennen vaihetta 2.

---

## Azure-käyttöönotto "for dummies"

Tämä on uutta sinulle, joten tässä jokainen klikkaus. Tarvitset lopussa vain
**kaksi tietoa**: avaimen (KEY) ja alueen (REGION). Ne syötetään koodiin.

### Vaihe A — Azure-tili

1. Mene osoitteeseen **https://azure.microsoft.com/free**
2. Klikkaa **"Start free"** / **"Aloita ilmaiseksi"**.
3. Kirjaudu Microsoft-tilillä (tai luo tili). Tarvitset:
   - sähköpostin
   - puhelinnumeron (vahvistus tekstiviestillä)
   - luottokortin **henkilöllisyyden vahvistamiseen** (ei veloiteta automaattisesti;
     ilmainen taso ei muutu maksulliseksi ilman että itse vaihdat sen).
4. Kun tili on luotu, päädyt **Azure Portaliin**: https://portal.azure.com

> Ilmainen kokeilu antaa ~200 $ krediittiä 30 päiväksi, MUTTA puheentunnistuksessa
> on lisäksi **pysyvästi ilmainen F0-taso: 5 äänituntia kuukaudessa ilmaiseksi**.
> Kokeiluun tämä riittää helposti, etkä maksa mitään.

### Vaihe B — Luo "Speech"-resurssi

1. Azure Portalissa, ylhäällä hakukenttään kirjoita **"Speech"**.
2. Valitse **"Speech services"** (puhepalvelut).
3. Klikkaa **"+ Create"** / **"Luo"**.
4. Täytä lomake:
   - **Subscription:** valmiina (tilisi tilaus).
   - **Resource group:** klikkaa "Create new", anna nimi esim. `elvi`.
   - **Region / Alue:** valitse **"West Europe"** (lähellä, hyvä viive).
     - ⚠️ **Merkitse tämä muistiin** — tämä on koodin `REGION`, mutta koodissa
       muodossa `westeurope` (pienellä, ilman välilyöntiä).
   - **Name:** anna nimi esim. `elvi-speech` (tämä näkyy vain sinulle).
   - **Pricing tier / Hinnoittelutaso:** valitse **"Free F0"** (ilmainen).
     - Jos F0 ei ole valittavissa (joskus rajoitettu), valitse **"Standard S0"** —
       se on edullinen (~1 €/tunti) ja perhekäytössä käytännössä ilmainen.
5. Klikkaa **"Review + create"**, sitten **"Create"**.
6. Odota ~1 min. Kun valmis, klikkaa **"Go to resource"**.

### Vaihe C — Hae avain ja alue

1. Resurssin sivulla, vasemmasta valikosta valitse
   **"Keys and Endpoint"** (Avaimet ja päätepiste).
2. Näet:
   - **KEY 1** ja **KEY 2** (kaksi avainta — kumpi tahansa käy)
   - **Location/Region** (esim. `westeurope`)
3. Kopioi **KEY 1** ja **Region**. Nämä kaksi tietoa menevät koodiin:

   ```js
   const AZURE_KEY = "tähän_kopioitu_avain";
   const AZURE_REGION = "westeurope";
   ```

> **Jos avain vuotaa tai testi on ohi:** samalla sivulla on **"Regenerate Key 1"** —
> yksi klikkaus tekee vanhasta avaimesta hyödyttömän. Käytä tätä huoletta.

### Vaihe D — Kustannusten seuranta (valinnainen mutta suositeltu)

1. Portalin hausta **"Cost Management"** → **"Cost alerts"**.
2. Aseta halutessasi hälytys esim. 5 €:n kohdalle, niin saat sähköpostin jos
   kulutus yllättää. F0-tasolla tätä ei käytännössä tarvita.

---

## Mitä Azure maksaa (yhteenveto)

| Taso | Hinta | Sopii |
|------|-------|-------|
| **F0 (Free)** | 0 € — 5 äänituntia/kk ilmaiseksi | Kokeiluun ja kevyeen perhekäyttöön |
| **S0 (Standard)** | ~1 €/äänitunti | Jos F0 loppuu tai ei ole saatavilla |

Perhekäytössä jäät erittäin todennäköisesti ilmaisen tason sisälle.

---

## Vaiheet 2 ja 3 (lyhyesti — rakennetaan myöhemmin)

Ei toteuteta vielä, mutta tässä suunta:

### Vaihe 2 — Tekstin siirto kuurolle
- Firebase Realtime Database (eurooppalainen instanssi)
- Puhuja kirjoittaa litteroinnin Firebaseen: `recognizing` → `currentText.interim`,
  `recognized` → `messages/` (kertyvä lista, jotta lukija ei menetä tekstiä)
- Tabletin lukijanäkymä kuuntelee Firebasea ja näyttää **vierivän tekstivirran**
  suurella fontilla
- Istunnon luonti tabletilla + QR-koodi + numerokoodi puhujan liittymiseen
- Tabletti ei pyydä mikrofonilupaa

### Vaihe 3 — Viimeistely
- PWA: manifest.json, sw.js (network first), ikonit, asennettavuus
- Screen Wake Lock (tabletin näyttö ei sammu kesken keskustelun)
- Fonttikoon säätö, tyhjennys, käsinkirjoitettu varateksti puhujalle
- Istunnon automaattinen vanheneminen
- **Token-palvelu** Azure-avaimelle (avain pois selaimesta)

---

## Tärkeät tekniset huomiot (muistilista)

- **Vierivä tekstivirta, ei ylikirjoitus:** lukija lukee hitaammin kuin puhe etenee.
  Valmiit lauseet kertyvät listaan, eivät korvaa edellistä. (Vaihe 2.)
- **Interim-päivitysten throttle:** kun siirrytään Firebaseen, rajoita
  keskeneräisen tekstin kirjoituksia (~5/s), ettei kiintiö/viive kärsi. (Vaihe 2.)
- **Mikrofoni vaatii HTTPS:n.** GitHub Pages tai muu HTTPS-hostaus pakollinen
  puhelintestauksessa.
- **Puhuja lähellä mikkiä** = parempi tarkkuus. Tämä on yksi syy kahden laitteen malliin.
```
