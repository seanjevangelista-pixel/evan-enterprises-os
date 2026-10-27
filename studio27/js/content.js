/* ============================================================
   STUDIO 27 — SITE CONTENT
   ------------------------------------------------------------
   This is the only file you need to edit to update the site.
   No build step. Save the file, refresh the browser.

   >>> BEFORE LAUNCH, REPLACE EVERY VALUE MARKED "TODO". <<<
   The entries below are placeholder entries so the grid has
   something to render. Swap them for real people and photos.
   ============================================================ */

/* ---------- 1. Studio details ----------------------------------
   Used in the nav, footer, contact page, and schema markup.
   No phone number is shown on the site yet — add STUDIO.phone
   and STUDIO.phoneHref back once there's a real business line. */
const STUDIO = {
  name:      'Studio 27',
  email:     'studio27.atx@gmail.com',
  city:      'Austin, TX',
  instagram: 'https://instagram.com/studio27.atx',
  igHandle:  '@studio27.atx',
  facebook:  'https://www.facebook.com/profile.php?id=61593685973563',
  fbName:    'Studio 27 ATX',
  tiktok:    'https://www.tiktok.com/@studio27.atx',
  ttHandle:  '@studio27.atx',
  founded:   '2025',
  bookingWindow: 'Booking 2026',

  /* Where the contact form posts. Leave as null and the form
     falls back to opening the visitor's email app with the
     message pre-filled — works with no backend at all.
     Set a URL (Formspree, Basin, or an Evan Enterprises API
     action) to capture submissions properly. */
  formEndpoint: '/api/contact'
};

/* ---------- 2. The community -------------------------------------
   Photographers, barbers, tattoo artists, musicians, and the
   space itself. This is not a client portfolio — it's who works
   here and what the studio looks like in use.

   To add someone, copy a block and change the values.

   category : photography | barbering | tattoo | music | space
   image    : path to a file in studio27/img/ — e.g. 'img/marcus-01.jpg'
              Leave as null to show the tonal placeholder frame.
   size     : 'wide' makes the tile span 2 columns on desktop.
              Use it on about 1 in 4 entries to break the grid up.
   client   : shown as the small subtitle under the name — their
              craft, chair, or role at the studio.
   instagram: handle shown on the Creatives page, e.g. '@marcus.cuts'.
              Leave as null to hide it and show a "Contact the studio" link instead. */
const PROJECTS = [
  {
    title: 'Studio Promo Reel',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: 'wide',
    image: '/img/work-video/ak40-poster.jpg',
    video: '/img/work-video/ak40.mp4',
    exif: 'In studio · Vertical',
    blurb: 'A studio-lit promo reel built for social — vertical format, ready to post.',
    deliverables: 'Vertical promo video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Night Drive',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: null,
    image: '/img/work-video/jb2-poster.jpg',
    video: '/img/work-video/jb2.mp4',
    exif: 'Downtown Austin, TX · Vertical',
    blurb: 'A rooftop parking garage shoot at night with the downtown skyline lit up behind.',
    deliverables: 'Vertical music video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Boxing Training',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: 'wide',
    image: '/img/work-video/av2-poster.jpg',
    video: '/img/work-video/av2.mp4',
    exif: 'On location · Boxing gym',
    blurb: 'A behind-the-ropes look at fight-camp training, shot ringside in the gym.',
    deliverables: 'Editorial video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Night Out — Dance Floor',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: null,
    image: '/img/work-video/maxxxxx-poster.jpg',
    video: '/img/work-video/maxxxxx.mp4',
    exif: 'Austin, TX · Vertical',
    blurb: 'Candid nightlife energy on the dance floor, captured handheld under neon light.',
    deliverables: 'Vertical event video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Park Editorial',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: 'wide',
    image: '/img/work-video/limf-poster.jpg',
    video: '/img/work-video/limf.mp4',
    exif: 'On location · Austin, TX',
    blurb: 'A golden-hour editorial shot in the park with the downtown skyline as backdrop, directed by Trinity White.',
    deliverables: 'Editorial video',
    creator: 'Jay Guerrero',
    director: 'Trinity White',
    instagram: null
  },
  {
    title: 'Studio Fashion Shoot',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: null,
    image: '/img/work-video/omnij1-poster.jpg',
    video: '/img/work-video/omnij1.mp4',
    exif: 'In studio · Vertical',
    blurb: 'A studio-lit fashion shoot on a ring backdrop, styled head to toe.',
    deliverables: 'Vertical fashion video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Gas Station Freestyle',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: 'wide',
    image: '/img/work-video/yes-poster.jpg',
    video: '/img/work-video/yes.mp4',
    exif: 'Austin, TX · Vertical',
    blurb: 'A late-night freestyle shot on location at a gas station, lit by the canopy lights.',
    deliverables: 'Vertical music video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Sneaker Detail',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: null,
    image: '/img/work-video/spacefinal-poster.jpg',
    video: '/img/work-video/spacefinal.mp4',
    exif: 'On location · Vertical',
    blurb: 'A moody fashion detail shot on footwear, lit low and shot close.',
    deliverables: 'Vertical fashion video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'City Night Portrait',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: null,
    image: '/img/work-video/wil4-poster.jpg',
    video: '/img/work-video/wil4.mp4',
    exif: 'Downtown Austin, TX · Vertical',
    blurb: 'A cinematic night portrait shot through a car window against the downtown skyline.',
    deliverables: 'Vertical music video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Gym B-Roll',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: null,
    image: '/img/work-video/ambf-poster.jpg',
    video: '/img/work-video/ambf.mp4',
    exif: 'On location · Boxing gym',
    blurb: 'Atmospheric B-roll shot inside a boxing gym for a brand content package.',
    deliverables: 'B-roll / brand content',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Athlete Profile',
    client: 'Videography',
    category: 'videography',
    year: '2026',
    size: null,
    image: '/img/work-video/apro-poster.jpg',
    video: '/img/work-video/apro.mp4',
    exif: 'On location · Boxing gym',
    blurb: 'A candid athlete-profile clip shot on location at the gym.',
    deliverables: 'Profile / documentary video',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Streetwear Look',
    client: 'Fashion Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/streetwear-hoodie.jpg',
    exif: 'On location · Austin, TX',
    blurb: 'A streetwear lookbook shoot, lit and shot on location.',
    deliverables: 'Lookbook photography',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Gameday Broadcast Desk',
    client: 'Sports Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/levi-gameday-broadcast.jpg',
    exif: 'On set · College football',
    blurb: 'A broadcast-desk portrait shot courtside during a college football gameday production.',
    deliverables: 'Sports & broadcast photography',
    creator: 'Levi Thompson',
    instagram: null
  },
  {
    title: 'Match Day — Austin FC',
    client: 'Sports Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/gio-soccer-01.jpg',
    images: ['/img/work/gio-soccer-01.jpg', '/img/work/gio-soccer-02.jpg'],
    exif: 'Q2 Stadium · Austin, TX',
    blurb: 'A contested midfield battle and a player mid-strike, shot pitch-side during an Austin FC match.',
    deliverables: 'Sports photography',
    creator: 'Giovanni Mondragon',
    instagram: null
  },
  {
    title: 'Graduation Portrait',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/blane-grad-01.jpg',
    exif: 'On location',
    blurb: 'A quiet graduation portrait shot outdoors, cap in hand.',
    deliverables: 'Graduation & senior portraits',
    creator: 'Blane Davis III',
    instagram: null
  },
  {
    title: 'Ironman Texas',
    client: 'Event Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/hector-ironman-finish.jpg',
    exif: 'Ironman Texas · The Woodlands',
    blurb: 'The finish line arch at Ironman Texas, shot for the race’s event coverage.',
    deliverables: 'Event photography',
    creator: 'Hector Alvarez',
    instagram: null
  },
  {
    title: 'Track Day — COTA',
    client: 'Automotive Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/morgan-cota-01.jpg',
    images: ['/img/work/morgan-cota-01.jpg', '/img/work/morgan-cota-02.jpg'],
    exif: 'Circuit of the Americas · Austin, TX',
    blurb: 'A Porsche and a BMW M2 on track at COTA, shot against the circuit\'s iconic tower — swipe for the second.',
    deliverables: 'Automotive photography',
    creator: 'Morgan Murrell',
    instagram: null
  },
  {
    title: 'Gameday Group Portrait',
    client: 'Sports Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/levi-gameday-group.jpg',
    exif: 'College campus · Gameday',
    blurb: 'A group portrait shot on a college campus during gameday festivities.',
    deliverables: 'Sports & event photography',
    creator: 'Levi Thompson',
    instagram: null
  },
  {
    title: 'High School Basketball',
    client: 'Sports Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/alex-basketball-01.jpg',
    images: ['/img/work/alex-basketball-01.jpg', '/img/work/alex-basketball-02.jpg'],
    exif: 'On location',
    blurb: 'Courtside coverage of a high school basketball game — swipe for the second.',
    deliverables: 'Sports photography',
    creator: 'Alex Guerrero',
    instagram: null
  },
  {
    title: 'Senior Portrait — Formal',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/blane-senior-formal.jpg',
    exif: 'On location',
    blurb: 'A formal senior portrait styled with an evening gown and a luxury car.',
    deliverables: 'Graduation & senior portraits',
    creator: 'Blane Davis III',
    instagram: null
  },
  {
    title: 'Boudoir Session',
    client: 'Boudoir Photography',
    category: 'photography',
    year: '2026',
    size: null,
    images: ['/img/work/boudoir-01.jpg', '/img/work/boudoir-02.jpg'],
    image: '/img/work/boudoir-01.jpg',
    exif: 'In studio',
    blurb: 'A styled boudoir session, shot and lit in studio — swipe for the second look.',
    deliverables: 'Boudoir photography',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'BBQ Pitmaster Team',
    client: 'Business & Promotional Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/jay-bbq-team.jpg',
    exif: 'On location · Austin, TX',
    blurb: 'A team portrait shot on site at the smoker for a local barbecue business.',
    deliverables: 'Business & promotional photography',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Festival Portrait',
    client: 'Event Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/gio-festival-portrait.jpg',
    exif: 'Outdoor festival',
    blurb: 'A styled portrait shot at an outdoor music festival.',
    deliverables: 'Event & fashion photography',
    creator: 'Giovanni Mondragon',
    instagram: null
  },
  {
    title: 'Artist Portrait — Backstage',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/gio-artist-portrait.jpg',
    exif: 'Festival stage',
    blurb: 'A backstage portrait shot in front of the LED wall between sets.',
    deliverables: 'Portrait photography',
    creator: 'Giovanni Mondragon',
    instagram: null
  },
  {
    title: 'Game Day Dunk',
    client: 'Sports Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/hector-basketball-dunk.jpg',
    exif: 'High school gym',
    blurb: 'A mid-air dunk frozen at the peak, shot courtside during a home game.',
    deliverables: 'Sports photography',
    creator: 'Hector Alvarez',
    instagram: null
  },
  {
    title: 'Fitness Studio Classes',
    client: 'Fitness Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/hector-fitness-class-01.jpg',
    images: ['/img/work/hector-fitness-class-01.jpg', '/img/work/hector-fitness-class-02.jpg'],
    exif: 'Move Fitness + Wellness',
    blurb: 'Group class energy at a boutique fitness studio, shot for their content library — swipe for the second.',
    deliverables: 'Fitness & wellness photography',
    creator: 'Hector Alvarez',
    instagram: null
  },
  {
    title: 'SXSW 2026 — Panel',
    client: 'Event Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/levi-sxsw-panel.jpg',
    exif: 'SXSW 2026 · Austin, TX',
    blurb: 'An audience shot from a WongDoody panel at SXSW 2026.',
    deliverables: 'Conference & event photography',
    creator: 'Levi Thompson',
    instagram: null
  },
  {
    title: 'Home Studio Session',
    client: 'Music Photography',
    category: 'music',
    year: '2026',
    size: 'wide',
    image: '/img/work/levi-music-session-01.jpg',
    images: ['/img/work/levi-music-session-01.jpg', '/img/work/levi-music-session-02.jpg', '/img/work/levi-music-session-03.jpg'],
    exif: 'Home studio',
    blurb: 'A vocal take, a beat mid-session, and the full home studio setup — swipe through the session.',
    deliverables: 'Music & artist photography',
    creator: 'Levi Thompson',
    instagram: null
  },
  {
    title: 'Graduation Portrait — Formal',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/blane-grad-02.jpg',
    exif: 'On location',
    blurb: 'A formal graduation portrait on a staircase, cap and gown paired with an evening look.',
    deliverables: 'Graduation & senior portraits',
    creator: 'Blane Davis III',
    instagram: null
  },
  {
    title: 'Prom Portrait — Rooftop',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/blane-prom-porsche.jpg',
    exif: 'Downtown Austin, TX',
    blurb: 'A prom portrait on a rooftop with the downtown skyline behind, styled with a Porsche Macan.',
    deliverables: 'Graduation & senior portraits',
    creator: 'Blane Davis III',
    instagram: null
  },
  {
    title: 'Tokyo',
    client: 'Travel Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/morgan-tokyo-01.jpg',
    images: ['/img/work/morgan-tokyo-01.jpg', '/img/work/morgan-tokyo-02.jpg'],
    exif: 'Tokyo, Japan',
    blurb: 'The Tokyo Skytree and an aerial view of the city along the Sumida River — swipe for the second.',
    deliverables: 'Travel photography',
    creator: 'Morgan Murrell',
    instagram: null
  },
  {
    title: 'Night Out',
    client: 'Event Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/nightlife-group.jpg',
    exif: 'Austin, TX',
    blurb: 'Candid group coverage from a night out — the kind of shot people actually want a copy of.',
    deliverables: 'Event photography',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Track Day — Hypercars',
    client: 'Automotive Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/alex-track-day-cota.jpg',
    images: ['/img/work/alex-track-day-cota.jpg', '/img/work/alex-hypercar-trailer.jpg'],
    exif: 'Circuit of the Americas · Austin, TX',
    blurb: 'A grid of hypercars on track at COTA, plus a trailer-side detail shot — swipe for the second.',
    deliverables: 'Automotive photography',
    creator: 'Alex Guerrero',
    instagram: null
  },
  {
    title: 'Gameday Tailgate',
    client: 'Event Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/gio-gameday-tailgate-01.jpg',
    images: ['/img/work/gio-gameday-tailgate-01.jpg', '/img/work/gio-gameday-tailgate-02.jpg'],
    exif: 'UT Austin · Gameday',
    blurb: 'Tailgate energy on gameday, shot for the crowd and the crew — swipe for the second.',
    deliverables: 'Event photography',
    creator: 'Giovanni Mondragon',
    instagram: null
  },
  {
    title: 'Fine Art Detail',
    client: 'Art & Product Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/jay-tyler-painting.jpg',
    images: ['/img/work/jay-tyler-painting.jpg', '/img/work/tattoo-portrait-painting.jpg'],
    exif: 'Detail shot',
    blurb: 'Macro detail shots documenting two pieces of original artwork — swipe for the second.',
    deliverables: 'Art & product photography',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Brand Campaign — Slick Babe',
    client: 'Brand Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/hector-brand-fashion.jpg',
    images: ['/img/work/hector-brand-fashion.jpg', '/img/work/hector-brand-product.jpg', '/img/work/hector-brand-lifestyle.jpg'],
    exif: 'On location',
    blurb: 'A fashion and lifestyle shoot for the Slick Babe brand, pairing styled portraits with product detail shots — swipe for more.',
    deliverables: 'Brand & product photography',
    creator: 'Hector Alvarez',
    instagram: null
  },
  {
    title: 'Graduation Portrait',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/gio-graduation-portrait-01.jpg',
    images: ['/img/work/gio-graduation-portrait-01.jpg', '/img/work/gio-graduation-portrait-02.jpg'],
    exif: 'On campus',
    blurb: 'A graduation portrait session shot on campus — swipe for the second.',
    deliverables: 'Graduation & senior portraits',
    creator: 'Giovanni Mondragon',
    instagram: null
  },
  {
    title: 'SXSW 2026 — Rooftop Activation',
    client: 'Event Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/levi-sxsw-fans.jpg',
    images: [
      '/img/work/levi-sxsw-fans.jpg',
      '/img/work/levi-sxsw-dancing.jpg',
      '/img/work/levi-sxsw-dancing-02.jpg'
    ],
    exif: 'SXSW 2026 · Austin, TX',
    blurb: 'Rooftop, street, and dance floor coverage of a SXSW 2026 brand activation — swipe through the set.',
    deliverables: 'Conference & event photography',
    creator: 'Levi Thompson',
    instagram: null
  },
  {
    title: 'Corporate Headshot',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/hector-corporate-portrait.jpg',
    exif: 'Studio backdrop',
    blurb: 'A clean corporate portrait built for a professional profile and marketing use.',
    deliverables: 'Corporate portraits',
    creator: 'Hector Alvarez',
    instagram: null
  },
  {
    title: 'Automotive Photography',
    client: 'Automotive Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/automotive-audi-r8.jpg',
    images: ['/img/work/automotive-audi-r8.jpg', '/img/work/automotive-lamborghini.jpg'],
    exif: 'Austin, TX',
    blurb: 'A rooftop shoot with a black Audi R8 and a Lamborghini Huracán Spyder on campus at UT Austin — swipe for the second.',
    deliverables: 'Automotive photography',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Senior Portrait — University of Houston',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/blane-senior-uh.jpg',
    exif: 'On location',
    blurb: 'A senior portrait built around school pride, shot on location with the car.',
    deliverables: 'Graduation & senior portraits',
    creator: 'Blane Davis III',
    instagram: null
  },
  {
    title: 'Pool Day',
    client: 'Lifestyle Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/gio-pool-day-01.jpg',
    images: ['/img/work/gio-pool-day-01.jpg', '/img/work/gio-pool-day-02.jpg', '/img/work/gio-pool-day-03.jpg'],
    exif: 'Rooftop pool',
    blurb: 'Candid rooftop pool day moments, shot in natural light — swipe for more.',
    deliverables: 'Lifestyle photography',
    creator: 'Giovanni Mondragon',
    instagram: null
  },
  {
    title: 'Classic Porsche — Hill Country',
    client: 'Automotive Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/alex-porsche-hillcountry.jpg',
    exif: 'Texas Hill Country',
    blurb: 'A classic Porsche 911 and its owner, shot on a hill country backroad at golden hour.',
    deliverables: 'Automotive photography',
    creator: 'Alex Guerrero',
    instagram: null
  },
  {
    title: 'Nightlife — Downtown Bar',
    client: 'Nightlife Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/levi-nightlife-bar-convo.jpg',
    images: ['/img/work/levi-nightlife-bar-convo.jpg', '/img/work/levi-nightlife-bar-crowd.jpg'],
    exif: 'Downtown Austin',
    blurb: 'Candid crowd and bar moments shot for a downtown nightlife venue — swipe for the second.',
    deliverables: 'Nightlife & venue photography',
    creator: 'Levi Thompson',
    instagram: null
  },
  {
    title: 'Retail Interior',
    client: 'Commercial Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/hector-retail-interior.jpg',
    exif: 'On location',
    blurb: 'An interior shot of a streetwear shop, built for the brand’s marketing and socials.',
    deliverables: 'Commercial & retail photography',
    creator: 'Hector Alvarez',
    instagram: null
  },
  {
    title: 'Stage Portrait',
    client: 'Music Photography',
    category: 'music',
    year: '2026',
    size: 'wide',
    image: '/img/work/artist-portrait.jpg',
    images: ['/img/work/artist-portrait.jpg', '/img/work/jay-stage-mic.jpg', '/img/work/jay-stage-green.jpg'],
    exif: 'Live show',
    blurb: 'A backstage portrait, a live performance shot, and a green-lit stage portrait — swipe through the set.',
    deliverables: 'Music & artist photography',
    creator: 'Jay Guerrero',
    instagram: null
  },
  {
    title: 'Ranch Portrait',
    client: 'Portrait Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/alex-ranch-portrait.jpg',
    exif: 'Texas Hill Country',
    blurb: 'A candid ranch portrait shot at golden hour under the live oaks.',
    deliverables: 'Portrait photography',
    creator: 'Alex Guerrero',
    instagram: null
  },
  {
    title: 'Real Estate Interior',
    client: 'Real Estate Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/gio-real-estate-interior-01.jpg',
    images: [
      '/img/work/gio-real-estate-interior-01.jpg',
      '/img/work/gio-real-estate-interior-02.jpg',
      '/img/work/gio-real-estate-interior-03.jpg',
      '/img/work/gio-real-estate-interior-04.jpg'
    ],
    exif: 'On location',
    blurb: 'A living room and kitchen shot for a real estate listing — swipe through the set.',
    deliverables: 'Real estate photography',
    creator: 'Giovanni Mondragon',
    instagram: null
  },
  {
    title: 'Gym Training Session',
    client: 'Fitness Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/hector-gym-training.jpg',
    exif: 'On location',
    blurb: 'A trainer and client mid-session, shot for a gym’s marketing content.',
    deliverables: 'Fitness & wellness photography',
    creator: 'Hector Alvarez',
    instagram: null
  },
  {
    title: 'Garden Social',
    client: 'Event Photography',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/levi-garden-social-01.jpg',
    images: [
      '/img/work/levi-garden-social-01.jpg',
      '/img/work/levi-garden-social-02.jpg',
      '/img/work/levi-garden-social-03.jpg',
      '/img/work/levi-garden-social-04.jpg',
      '/img/work/levi-garden-social-05.jpg'
    ],
    exif: 'On location · Austin, TX',
    blurb: 'A golden-hour garden social — string lights, red umbrellas, and candid guest moments — swipe for more.',
    deliverables: 'Event photography',
    creator: 'Levi Thompson',
    instagram: null
  },
  {
    title: 'Downtown Construction',
    client: 'Architecture Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/alex-downtown-crane.jpg',
    exif: 'Downtown Austin, TX',
    blurb: 'A crane lifting a load between two towers in downtown Austin, shot from street level.',
    deliverables: 'Architecture & commercial photography',
    creator: 'Alex Guerrero',
    instagram: null
  },
  {
    title: 'Racing Driver Portrait',
    client: 'Motorsport Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/alex-racing-driver-portrait.jpg',
    exif: 'On location',
    blurb: 'A black-and-white portrait of a racing driver, suited up and ready for the grid.',
    deliverables: 'Motorsport photography',
    creator: 'Alex Guerrero',
    instagram: null
  },
  {
    title: 'DJ Set',
    client: 'Nightlife Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/alex-nightlife-dj.jpg',
    exif: 'Austin, TX',
    blurb: 'A DJ mid-set under the club lights, shot for the venue.',
    deliverables: 'Nightlife & venue photography',
    creator: 'Alex Guerrero',
    instagram: null
  },
  {
    title: 'Meaty Boys BBQ',
    client: 'Small Business Photography',
    category: 'photography',
    year: '2026',
    size: null,
    image: '/img/work/alex-bbq-foodtruck.jpg',
    exif: 'On location',
    blurb: 'A portrait for a local BBQ food truck, shot for their branding and socials.',
    deliverables: 'Small business & branding photography',
    creator: 'Alex Guerrero',
    instagram: null
  },
  {
    title: 'Trinity',
    client: 'Creative Shoot',
    category: 'photography',
    year: '2026',
    size: 'wide',
    image: '/img/work/trinity-01.png',
    images: ['/img/work/trinity-01.png', '/img/work/trinity-02.png'],
    exif: 'Studio 27, Austin, TX',
    blurb: 'A creative shoot at Studio 27, directed by Trinity White.',
    deliverables: 'Creative photography',
    director: 'Trinity White',
    instagram: null
  }
];

/* ---------- 3. Category labels ---------------------------------
   Order here is the order the filters appear in.               */
const CATEGORIES = [
  { key: 'all',         label: 'All' },
  { key: 'photography', label: 'Photography' },
  { key: 'videography', label: 'Videography' },
  { key: 'barbering',   label: 'Barbering' },
  { key: 'tattoo',      label: 'Tattoo' },
  { key: 'music',       label: 'Music' },
  { key: 'space',       label: 'The Space' }
];

/* ---------- 4. Services ---------------------------------------- */
const SERVICES = [
  {
    key: 'WD',
    name: 'Website Creation & Design',
    desc: 'Custom websites designed and built to match your brand, from a single landing page to a full site.',
    tag: 'Per project',
    href: '/services#website'
  },
  {
    key: 'AD',
    name: 'Ad Management',
    desc: 'Paid ad campaigns planned, launched, and optimized across platforms to bring in the right traffic.',
    tag: 'Monthly retainer',
    href: '/services#ads'
  },
  {
    key: 'PH',
    name: 'Photography',
    desc: 'Portraits, product, and editorial stills. Studio or location, retouched and delivered ready to publish.',
    tag: 'Half day / Full day',
    href: '/services#photography'
  },
  {
    key: 'VD',
    name: 'Videography',
    desc: 'Short-form and social video, shot and edited in house.',
    tag: 'Per project',
    href: '/services#videography'
  },
  {
    key: 'CC',
    name: 'Content Creation',
    desc: 'Stills and vertical video built for a posting calendar, not a one-off.',
    tag: 'Retainer',
    href: '/services#content'
  },
  {
    key: 'BB',
    name: 'Barbering',
    desc: 'Cuts, fades, and beard work from a licensed barber working out of the space.',
    tag: 'By appointment',
    href: '/services#barbering'
  },
  {
    key: 'SF',
    name: 'Short Film / Campaign',
    desc: 'Short-form narrative and brand campaign videos, planned and shot start to finish.',
    tag: 'Per project',
    href: '/services#film'
  },
  {
    key: 'PB',
    name: 'Photo Booth Rentals',
    desc: 'The Studio 27 iPad photo booth — self-service, and photos sent straight to your phone.',
    tag: 'See packages',
    href: '/photo-booth'
  },
  {
    key: 'CD',
    name: 'Creative Direction',
    desc: 'Big-picture guidance on brand look and feel — keeping every shoot, post, and asset on one identity.',
    tag: 'Per project or retainer',
    href: '/services#creative-direction'
  }
];

/* ---------- 5. Photo booth packages ----------------------------
   The iPad Photo Booth only — every booking is a 2-hour minimum. */
const BOOTH_PACKAGES = [
  {
    name: 'Photo Booth',
    price: '$250',
    unit: 'Two hours · Add hours at $75',
    feature: false,
    badge: null,
    items: [
      'Studio 27 iPad Photo Booth',
      'Unlimited photos for the full run',
      'Self-service — easy for guests to use on their own',
      'Photos sent straight to guests\' phones',
      'Online gallery',
      'Props for guests to use'
    ]
  },
  {
    name: 'Photo Booth + Backdrop',
    price: '$325',
    unit: 'Two hours · Add hours at $75',
    feature: true,
    badge: 'Most booked',
    items: [
      'Everything in Photo Booth',
      'Backdrop of your choice (basic white included)',
      'Props for guests to use',
      'Online gallery'
    ]
  },
  {
    name: 'Photo Booth + Photographer',
    price: 'Starting at $600',
    unit: 'Two hours · Add hours at $75',
    feature: false,
    badge: null,
    items: [
      'Everything in Photo Booth + Backdrop',
      'A Studio 27 photographer on site for the full run',
      'Props for guests to use'
    ]
  }
];

/* ---------- 6. Photo booth add-ons ------------------------------ */
const BOOTH_ADDONS = [
  { name: 'Extra / professional lighting', price: '$40' },
  { name: 'Additional hour', price: '$75 per extra hour' }
];

/* ---------- 6b. Business add-ons ---------------------------------
   For businesses booking the booth for lead capture / branding.  */
const BUSINESS_ADDONS = [
  { name: 'Lead capture — photo + phone number', price: '$100' },
  { name: 'Business logo on overlay', price: '$50' },
  { name: 'Branded online gallery', price: '$50' },
  { name: 'Full branding package', price: '$125' }
];

/* ---------- 8. Founder ------------------------------------------
   Shown on the About page.                                      */
const FOUNDER = {
  name: 'Jay Guerrero',
  role: 'Founder, Studio 27',
  photo: '/img/founder.jpg',
  story: [
    {
      title: 'The Beginning',
      text: 'Born in Corpus Christi and raised along the I-35 corridor, I eventually found my way to Austin and started building a life around creativity.'
    },
    {
      title: 'The Idea',
      text: 'The idea for Studio 27 started in 2022 when I wanted to become a barber. I imagined a place where different creatives could work under one roof.'
    },
    {
      title: 'The Expansion',
      text: 'As I became a licensed barber, I also discovered a love for photography and videography. That made me realize Studio 27 could grow into something much bigger than one type of studio.'
    },
    {
      title: 'The Vision',
      text: 'Studio 27 is meant to be a home for different creatives, ideas, and industries. The goal is simple: one studio, many creatives, all bringing their own style and vision into the same space.'
    }
  ]
};

/* ---------- 9. Team / Creatives directory -----------------------
   Shown on the Creatives page, grouped and ordered by ROLE_ORDER.
   photo   : path to a headshot in studio27/img/, or null for a
             placeholder frame.
   email, phone, instagram : any can be null to hide that row.    */
const ROLE_ORDER = ['Owner / Photographer / Videographer', 'Creative / Ads & Web', 'Web Designer', 'Creative Director', 'Photographer / Videographer', 'Photographer'];

const TEAM = [
  {
    name: 'Sean Jayme',
    role: 'Creative / Ads & Web',
    photo: '/img/team-sean-jayme.jpg',
    photoPosition: 'center 20%',
    bio: 'I\'m a creative based in Austin, Texas, working mainly in UGC content, web design, and ads management. I started my first e-commerce business at 16, and posting that journey on social media is what pulled me into UGC — which led me into ads, and everything else in the social media space. I love building websites and love making people happy with the work I put out.',
    email: 'seanjevangelista@gmail.com',
    phone: '(512) 876-9751',
    instagram: '@officialseanjayme',
    tiktok: '@seanevangelista_'
  },
  {
    name: 'Jay Guerrero',
    role: 'Owner / Photographer / Videographer',
    photo: '/img/founder.jpg',
    photoTall: true,
    photoPosition: 'center 15%',
    bio: 'Studio 27 started with creativity long before it became a business. I bought my first DSLR almost on impulse and barely touched it for a year. One night while taking photos of a friend around downtown Austin, I remembered I had a real camera sitting at home. After that, we started going out after work almost every night to shoot, especially cars, which eventually led me into automotive photography, and then into all kinds of photo and video work, including becoming a photographer for a popular club on 6th Street. That creative journey helped shape the idea behind Studio 27, a space where different creatives, styles, and industries can come together under one roof.',
    email: 'Jayyd1gitaal@gmail.com',
    phone: null,
    instagram: '@jayd1gital'
  },
  {
    name: 'Trinity White',
    role: 'Creative Director',
    photo: '/img/team-trinity-white.jpg',
    bio: 'I\'m an artist and multidisciplinary creative who found my way into creative direction through my love for art, modeling, and visual storytelling. I wanted to find ways to incorporate my artistic eye into photo shoots and bring creative concepts to life. After others began recognizing my creativity, I started helping curate shoots and work with clients to turn their visions into something more unique and intentional. Creative direction has allowed me to bring all of my creative skills together and create visuals that feel authentic and original.',
    email: 'trinitywhite86@gmail.com',
    phone: '(254) 338-0182',
    instagram: '@trinlwhite'
  },
  {
    name: 'Alex Guerrero',
    role: 'Photographer / Videographer',
    photo: '/img/team-alex-guerrero.jpg',
    bio: 'I\'ve been working professionally in photography and videography for four years. My journey began during my junior year when I bought my brother\'s old Lumix GX7, and from there I taught myself everything from manual settings to shooting and editing video. As my skills grew, photography introduced me to new people, clients, and unforgettable experiences. Now I\'m chasing my dreams while helping others capture theirs — all thanks to God, my family, and friends who believed in my vision.',
    email: 'alexguerrerophotos@gmail.com',
    phone: '(512) 566-8514',
    instagram: '@a1exshots'
  },
  {
    name: 'Blane Davis III',
    role: 'Photographer / Videographer',
    photo: '/img/team-blane-davis.jpg',
    bio: 'I really got into photography after already having a background in art and painting. I\'ve always loved creating and finding different ways to bring ideas to life, so photography felt like a natural next step for me. After spending some time with photography, I started exploring video and realized I connected with it even more. Since then, I\'ve been focused on videography, learning more about filmmaking, and continuing to develop my skills with the goal of creating my own short films and cinematic projects in the future.',
    email: 'blaneddavisiii@gmail.com',
    phone: '(737) 315-9061',
    instagram: '@dv5studios'
  },
  {
    name: 'Levi Thompson',
    role: 'Photographer',
    photo: '/img/team-levi-thompson.jpg',
    bio: 'Photography started for me as a form of admiration. I grew up flipping through my family\'s scrapbooks, and I became fascinated with the idea of capturing memories that you could always look back on. That admiration eventually turned into curiosity. In high school, I spent a lot of time on Tumblr scrolling through photos and trying to understand how they were made. After getting the chance to use a few of my friends\' cameras, I knew I wanted one of my own. The summer after my junior year, I worked at a summer camp to save up for one, and with help from my mom, I was finally able to get it. Around that same time, I joined my school newspaper and was assigned to photograph football games. That\'s where my passion for sports photography really started, and over time it grew into a love for capturing movement, energy, and timeless moments. Today, my work is focused mainly on lifestyle and music photography.',
    email: 'info@levijpg.com',
    phone: '(504) 292-1244',
    instagram: '@levijpg',
    website: 'http://levijpg.com'
  },
  {
    name: 'Giovanni Mondragon',
    role: 'Photographer',
    photo: '/img/team-gio-mondragon.jpg',
    photoTall: true,
    photoPosition: 'center 38%',
    bio: 'My journey into photography honestly started by accident. I never planned on becoming a photographer or imagined it would become a career. It all began when a rapper I knew mistakenly thought I was already a photographer. Instead of correcting him, I decided to run with it and see where the opportunity would take me. A few months later, I began photographing friends, family, barbers, local businesses, and anything else that gave me a chance to practice and improve. What started as something completely unexpected eventually became something I genuinely fell in love with. Now, four years later, I\'ve had the opportunity to photograph everything from professional soccer and other sports to weddings, couples, concerts, nightlife, events, brands, and much more. I\'ve always been the type of photographer who wants to do it all, and that mindset has allowed me to grow, connect with incredible people, and turn something that started by accident into a career I\'m truly proud of.',
    email: 'giovannimondragon2017@gmail.com',
    phone: '(512) 828-1253',
    instagram: '@gioinparis',
    instagram2: '@gioshothat',
    website: 'http://www.gioshothat.com'
  },
  {
    name: 'Hector Alvarez',
    role: 'Photographer / Videographer',
    photo: '/img/team-hector-alvarez.jpg',
    photoPosition: 'center 30%',
    bio: 'My freelance journey began when I stepped in as a substitute photographer at a powerlifting meet in San Antonio. Since then, I\'ve spent nearly four years capturing everything from proposals and Ironman documentaries to corporate events and local businesses. As an Austin native working full-time at a gym, I\'ve built a strong connection to the fitness community while continuing to grow alongside other creatives. Whatever I\'m shooting, my goal is to capture meaningful moments and help people tell their stories in a way that makes them feel seen and represented.',
    email: 'Stiiillmedia@gmail.com',
    phone: '(512) 586-1857',
    instagram: '@stiiillmedia',
    website: 'http://stiiillmedia.com'
  },
  {
    name: 'Morgan Murrell',
    role: 'Photographer',
    photo: '/img/team-morgan-murrell.jpg',
    photoTall: true,
    bio: 'I\'m a photographer originally from Houston, Texas, and I\'ve always been interested in the arts. Photography became another outlet for me to create and express myself in my spare time. What I enjoy most is being able to take something I find interesting and show it through my own perspective, whether that\'s a place, a person, or a moment that might otherwise go unnoticed. I started taking photos at car meets a few years ago. I was drawn to the details of the cars, the people who brought them together, and how much there was to capture at each meet. That\'s where I began exploring what I liked to photograph and developing my own eye. Cars are still one of my favorite subjects, but over time I\'ve found myself bringing my camera to more places and pointing it at more things. These days, I enjoy photographing landscapes, cityscapes, friends, cool cars, and anything else that catches my attention. I like having the freedom to follow my curiosity and create without limiting myself to one type of photography. For me, it\'s a way to keep exploring the world around me, make art out of what I see, and share the things that make me stop and look a little closer.',
    email: 'morgegg@gmail.com',
    phone: '(832) 561-9743',
    instagram: '@photosbymrgn'
  }
];
