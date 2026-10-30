# Skenování ve v1.2.4

1. Otevři Scan cards a spusť zadní fotoaparát.
2. Ve **stálém** růžovém poli měj název karty, v modrém ID. Kartu nemusíš přesně vyrovnat podle okrajů.
3. Automatický skener je zapnutý vždy. Po nalezení ID dvakrát za sebou se otevře potvrzovací okno; při nerozpoznaném ID se zkusí název. Více karet se stejným názvem vede k nabídce konkrétního ID.
4. Potvrď obrázek, počet a box; stiskni Add & next card. Další karta se skenuje po potvrzení uložení v Supabase.
5. Pokud nerozpozná automatika, použij Capture card. Diagnostika OCR ukáže skutečný výřez i přečtený text.

Odhadovaný cíl 1–2 sekund při ostrém obraze není záruka. Výkon závisí na fotoaparátu, rozlišení a aktuálním vytížení telefonu.

Nová poloha polí na referenčním iPhone záznamu:
- NAME: left 22%, top 75%, width 57%, height 8%.
- ID: left 71%, top 83%, width 25%, height 6,5%.

Jde o pevné oblasti, nejde o automatickou detekci hran karty.
