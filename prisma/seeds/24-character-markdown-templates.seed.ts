import {
  CharacterKinshipType,
  CharacterRelationshipCategory,
  CharacterRole,
  CharacterStatus,
  PrismaClient,
} from '@prisma/client';
import { runSeedStep } from './seed-step.util';

type CharacterTemplateSeed = {
  username: string;
  worldSlug: string;
  name: string;
  slug: string;
  alias: string[];
  role: CharacterRole;
  status: CharacterStatus;
  age?: string;
  avatarUrl?: string;
  tags: string[];
  appearance: string;
  personality: string;
  motivations: string;
  fears: string;
  strengths: string;
  weaknesses: string;
  backstory: string;
  arc: string;
};

const CHARACTER_SEEDS: CharacterTemplateSeed[] = [
  {
    username: 'demo_writer',
    worldSlug: 'el-mundo-del-velo',
    name: 'Isolde Veyra',
    slug: 'isolde-veyra',
    alias: ['La Custodia del Faro', 'La Madre de Ceniza'],
    role: CharacterRole.MENTOR,
    status: CharacterStatus.ALIVE,
    age: '43',
    avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=isolde-veyra',
    tags: ['matriarca', 'estratega', 'velo', 'linaje'],
    appearance: `# Ficha visual

| Rasgo | Detalle |
| --- | --- |
| Altura | 1.78 m |
| Presencia | Serena, firme y ceremonial |
| Vestimenta | Capas de viaje con bordados de cobre y sal |
| Señal distintiva | Una cicatriz blanca sobre la clavicula izquierda |

## Descripcion

Isolde proyecta la clase de autoridad que no necesita elevar la voz. Lleva el cabello oscuro recogido con agujas de metal opaco y suele vestir prendas funcionales, pero rematadas con detalles rituales que recuerdan a los viejos cartografos del Velo. Sus manos muestran quemaduras antiguas, como si hubiera sostenido mapas demasiado vivos durante demasiado tiempo.

> "Quien aprende a leer un borde, aprende tambien a no caer en el."

## Referencias visuales

- **Paleta:** cobre envejecido, azul humo, marfil ceniza
- **Texturas:** cuero salado, lino pesado, papel marcado por humedad
- **Moodboard:** [Archivo de referencia](https://hieloyfuego.fandom.com/wiki/)`,
    personality: `# Temperamento

Isolde combina disciplina emocional con una ternura dificil de advertir a primera vista. Escucha en silencio, interviene solo cuando la situacion ya se ha definido y rara vez ofrece una respuesta inmediata si considera que alguien todavia no ha pensado suficiente.

## Rasgos dominantes

- **Estrategica:** calcula escenarios a largo plazo.
- **Protectora:** prefiere cargar ella con las consecuencias.
- **Inflexible:** le cuesta aceptar improvisaciones ajenas.
- **Ceremonial:** da valor a los simbolos y a la memoria del linaje.

## Como la perciben otros

1. Los aliados la ven como una muralla fiable.
2. Sus hijos la sienten exigente incluso cuando intenta cuidar.
3. Sus enemigos la confunden con inmovilidad y suelen descubrir tarde que no lo es.`,
    motivations: `# Motivaciones

La prioridad de Isolde es impedir que la fragmentacion del Velo vuelva a cobrarse una generacion entera de cartografos. Quiere dejar a sus herederos un mapa politico menos roto que el que ella recibio y demostrar que la custodia del conocimiento no tiene por que convertirse en tirania.

## Objetivos concretos

- Proteger el Faro de Ceniza y su archivo.
- Mantener con vida a su linaje pese a las deudas antiguas.
- Evitar que Kael herede un conflicto que no eligio.
- Reconstruir pactos con casas menores antes de una nueva ruptura.`,
    fears: `# Miedos

- **Perder a su familia por decisiones tomadas en nombre del deber.**
- **Convertirse en la misma clase de guardiana que antes detesto.**
- **Que la historia oficial borre de nuevo a los suyos.**

## Nucleo del temor

Isolde no teme morir. Teme sobrevivir lo suficiente como para mirar atras y descubrir que protegió la estructura y no a las personas dentro de ella.`,
    strengths: `# Fortalezas

| Area | Nivel |
| --- | --- |
| Diplomacia | Alto |
| Lectura simbolica | Muy alto |
| Resistencia emocional | Alto |
| Liderazgo tactico | Alto |

## Ventajas practicas

- Reconoce patrones rituales con rapidez.
- Negocia desde la calma incluso bajo presion.
- Tiene autoridad real sobre guardianes y cronistas.
- Sabe convertir una derrota parcial en margen de maniobra.`,
    weaknesses: `# Debilidades

- Le cuesta pedir ayuda.
- Tiende a ocultar informacion "por proteccion".
- Confunde control con estabilidad cuando la crisis escala.
- Sobreestima su capacidad para absorber daño politico.

## Punto vulnerable

Cuando su familia entra en peligro, su juicio se estrecha y deja de actuar como estadista para actuar solo como madre.`,
    backstory: `# Perfil de personaje estilo fandom

## Ficha rapida

| Dato | Valor |
| --- | --- |
| Nombre completo | Isolde Veyra |
| Alias | La Custodia del Faro |
| Edad | 43 |
| Afiliacion | Faro de Ceniza |
| Estado | Activa |

## Resumen

Isolde Veyra es una de las ultimas custodias del archivo costero que sobrevivio a las purgas del Velo. Durante dos decadas sostuvo pactos inestables entre casas cartografas, puertos independientes y escribas exiliados. Su figura se mueve entre la politica, la maternidad y la guerra fria ritual que define el borde occidental del mundo.

## Historia

### Origen

Nacio dentro de un linaje secundario de guardianes sin tierras amplias, pero con acceso a cartas de navegacion prohibidas. Su madre murio cuando Isolde aun era joven y su educacion quedo en manos de una tia que entendia la cartografia como un oficio de supervivencia y no como una forma de nobleza.

### Desarrollo

Cuando el Faro de Ceniza fue parcialmente incendiado, Isolde lidero la evacuacion del archivo vivo hacia criptas mareales y gano una reputacion que mezclaba admiracion y recelo. Mas tarde acepto un matrimonio politico breve que le permitio sostener el faro, aunque nunca confio del todo en esa alianza.

### Estado actual

Ahora dirige una red de juramentos viejos, protege a sus hijos desde una distancia a veces insoportable y sospecha que el siguiente quiebre del Velo ocurrira mucho antes de lo previsto.

## Relaciones

- **Hijo:** Tarek Veyra
- **Aliado tenso:** Kael
- **Rivales:** casas menores de la Costa Rota

## Curiosidades

- Conserva mapas cosidos a mano dentro de su abrigo.
- Nunca se sienta dando la espalda a una salida.
- Guarda cartas sin enviar como si fueran juramentos.`,
    arc: `# Arco narrativo

## Punto de partida

Isolde cree que amar es contener, cubrir y decidir por otros si con eso les evita una herida.

## Evolucion

Conforme el conflicto avanza, descubre que su familia no necesita una pared perfecta, sino una lider capaz de compartir verdad, riesgo y responsabilidad.

## Punto de llegada

Su arco la empuja a abandonar la figura de guardiana absoluta para convertirse en una arquitecta de relevo, alguien que prepara sucesores en vez de seguir reemplazandolos.`,
  },
  {
    username: 'demo_writer',
    worldSlug: 'el-mundo-del-velo',
    name: 'Tarek Veyra',
    slug: 'tarek-veyra',
    alias: ['El Heredero del Borde'],
    role: CharacterRole.ALLY,
    status: CharacterStatus.ALIVE,
    age: '20',
    avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=tarek-veyra',
    tags: ['heredero', 'explorador', 'linaje', 'costa'],
    appearance: `# Apariencia

Tarek tiene la clase de fisico que sugiere velocidad antes que fuerza. Sus hombros aun no cargan del todo la solemnidad de su linaje, y eso juega a su favor: se mueve como si las reglas fueran apenas una sugerencia. Lleva el cabello negro largo hasta la nuca, ojos gris acero y una serie de brazaletes de navegacion que pertenecieron a su abuelo.

## Detalles rapidos

- Paso ligero, casi siempre inquieto.
- Ropa pensada para muelles, ruinas y torres de vigilancia.
- Dedos manchados por tinta, sal y polvo mineral.
- Usa una capa corta azul humo con costuras rehechas por el mismo.`,
    personality: `# Personalidad

Tarek es curioso, afectivo y desafiante. No tiene la gravedad de su madre ni la paciencia de los viejos custodios, pero si una sensibilidad intensa para detectar hipocresias. Quiere creer en la utilidad de la tradicion, aunque le irrita todo lo que huela a obediencia vacia.

## Rasgos

- **Leal:** protege a los suyos incluso a costa de si mismo.
- **Impulsivo:** actua antes de medir consecuencias largas.
- **Brillante en movimiento:** piensa mejor caminando, investigando o discutiendo.
- **Hambriento de verdad:** no tolera secretos familiares por mucho tiempo.`,
    motivations: `# Motivaciones

Tarek quiere demostrar que el legado Veyra puede servir para abrir caminos y no solo para administrarlos. Busca ganarse un lugar propio, no heredado, y desentrañar por que su linaje sigue apareciendo una y otra vez en cartas prohibidas.

## Lo que persigue

1. Construir una identidad fuera de la sombra de Isolde.
2. Encontrar archivos perdidos que expliquen el origen de la deuda familiar.
3. Defender a quienes viven en los bordes del mapa oficial.`,
    fears: `# Temores

- Ser reducido a "hijo de" durante toda su vida.
- Repetir la misma dureza emocional de su madre.
- Descubrir que el linaje Veyra si hizo algo imperdonable.
- Sobrevivir mientras otros pagan el precio de su curiosidad.`,
    strengths: `# Fortalezas

- Navegacion costera
- Lectura de ruinas y marcas
- Rapidez para improvisar rutas
- Carisma desordenado pero autentico

## Ventaja narrativa

Tarek conecta con personajes que desconfiarian de figuras mas solemnes; abre puertas que la autoridad formal no puede abrir.`,
    weaknesses: `# Debilidades

| Punto | Impacto |
| --- | --- |
| Impaciencia | Se adelanta a planes mas grandes |
| Orgullo | Le cuesta admitir miedo |
| Inexperiencia politica | Subestima redes de poder |
| Necesidad de validacion | Lo empuja a asumir riesgos innecesarios |`,
    backstory: `# Ficha enciclopedica extensa

## Identidad

| Campo | Valor |
| --- | --- |
| Nombre original | Tarek Veyra |
| Alias | El Heredero del Borde |
| Titulo | Custodio en formacion |
| Debut | Cronicas costeras del Velo |
| Estado | Activo |

## Descripcion general

Tarek es el unico hijo reconocido de Isolde Veyra y uno de los pocos jovenes formados en lectura simbolica, navegacion costera y protocolos de archivo vivo. Donde otros herederos fueron moldeados para conservar silencio, Tarek fue educado entre restos, rumores y pactos sin cerrar. Esa mezcla lo volvio peligroso para el orden establecido y esperanzador para quienes buscan una reforma real.

## Biografia

### Antes de la historia

Crecio entre corredores de piedra humeda, fogatas de vigilia y salas donde la memoria se trataba como moneda politica. Su infancia estuvo marcada por ausencias explicadas a medias y por una serie de advertencias que nadie quiso convertir en respuestas.

### Arco inicial

Durante sus primeras expediciones clandestinas descubrio nombres tachados que vinculaban a su familia con rutas prohibidas. Ese hallazgo lo obligo a elegir entre obedecer a Isolde o empezar a investigar por su cuenta.

### Punto de quiebre

Al enfrentarse a testimonios que contradicen la version oficial del linaje, Tarek comprende que el amor familiar tambien puede ser una forma de censura.

### Situacion actual

Permanece entre la lealtad y la insubordinacion, decidido a abrir aquello que su madre ha pasado anos cerrando.`,
    arc: `# Arco

## Tema central

Madurar no significa dejar de cuestionar, sino aprender que una verdad mal administrada tambien puede destruir.

## Trayectoria

Tarek pasa de rebelde reactivo a heredero capaz de cargar contexto, consecuencias y comunidad.

## Estado esperado

Si completa su arco, dejara de perseguir la validacion de Isolde para construir una legitimidad propia.`,
  },
  {
    username: 'writer_luna',
    worldSlug: 'aetherya',
    name: 'Naerys Vale',
    slug: 'naerys-vale',
    alias: ['La Arquitecta del Cielo Bajo', 'Primera de Heliora'],
    role: CharacterRole.PROTAGONIST,
    status: CharacterStatus.ALIVE,
    age: '28',
    avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=naerys-vale',
    tags: ['protagonista', 'aetherya', 'ingeniera', 'cielo'],
    appearance: `# Perfil visual

Naerys mezcla el refinamiento academico con rastros evidentes de trabajo de campo. Sus uniformes nunca estan impecables porque siempre lleva herramientas, rollos de planos y piezas sueltas cosidas en bolsillos internos. Tiene la piel tostada por altitudes altas, el cabello cobrizo sujeto en trenzas cortas y una mirada analitica que rara vez descansa.

## Identidad rapida

| Dato | Valor |
| --- | --- |
| Estilo | Ingeniera de vuelo |
| Silueta | Atletica y compacta |
| Colores | cobre, crema, azul zafiro |
| Elemento iconico | gafas de viento con cristales fractales |`,
    personality: `# Personalidad

Naerys es meticulosa, ironica y obsesivamente competente. No romantiza el sacrificio; prefiere soluciones que funcionen y personas que cumplan. Sin embargo, bajo esa capa racional se mueve una rabia constante contra la jerarquia que decide quien merece seguridad y quien solo merece sobrevivir.

## Rasgos principales

- **Analitica**
- **Compasiva en privado**
- **Sarcastica bajo presion**
- **Intensamente responsable**`,
    motivations: `# Motivaciones

Su gran objetivo es rediseñar la infraestructura de Aetherya para que las plataformas bajas dejen de ser desechables. Para ella, cada puente, anclaje y corredor aereo es una decision politica antes que una obra tecnica.

## Objetivos

- Democratizar el acceso a rutas seguras.
- Exponer acuerdos corruptos entre academias y casas de altura.
- Construir una red de refugios tecnicos independientes.`,
    fears: `# Miedos

> "El sistema siempre intenta convertir el talento en un permiso temporal."

- Teme ser absorbida por la misma elite que critica.
- Le aterra perder a su hermano en una catastrofe evitable.
- No soporta la idea de convertirse en un simbolo vacio.`,
    strengths: `# Fortalezas

1. Ingenieria estructural
2. Mapeo de corrientes aereas
3. Liderazgo operativo en crisis
4. Capacidad de lectura politica en espacios tecnicos

## Complemento

Naerys destaca cuando debe traducir ideas complejas en decisiones concretas para grupos enteros.`,
    weaknesses: `# Debilidades

- Rigidez emocional.
- Dificultad para descansar o delegar.
- Puede sonar condescendiente cuando corrige.
- Su obsesion por arreglarlo todo la acerca al agotamiento cronicamente.`,
    backstory: `# Perfil de personaje estilo fandom

## Ficha rapida

| Dato | Valor |
| --- | --- |
| Nombre completo | Naerys Vale |
| Alias | La Arquitecta del Cielo Bajo |
| Edad | 28 |
| Raza / especie | Humana |
| Afiliacion | Talleres del Anillo Sur |
| Estado | Activa |

## Resumen

Naerys Vale es una ingeniera de Aetherya reconocida por rediseñar corredores de viento para zonas que la capital preferia olvidar. Su ascenso no nacio del favor noble, sino de años reparando estructuras donde fallar significaba que barrios enteros se desplomaran. Eso la convirtio en una figura util para el poder y peligrosa para su narrativa.

## Historia

### Origen

Nacio en una plataforma de servicio suspendida bajo Heliora, en un barrio donde cada generacion heredaba remaches, deudas y la sensacion de que el cielo estaba reservado para otros. Aprendio mecanica mirando a su madre soldar y a su padre negociar piezas con contrabandistas legales.

### Desarrollo

Una beca excepcional la llevo a la academia, pero alli entendio que el merito solo era celebrado mientras no alterara jerarquias. Tras un accidente masivo en una ruta inferior, Naerys abandono la carrera institucional y volvio a los talleres para organizar su propia red tecnica.

### Estado actual

Ahora opera como referente publica y tecnica del Cielo Bajo, en choque continuo con consejeros, almirantes y benefactores que quieren apropiarse de su legitimidad.

## Relaciones

- **Hermano:** Caelan Vale
- **Mentora politica:** Seren
- **Rival institucional:** Consejo de Heliora

## Curiosidades

- Toma notas en servilletas, metal, cuero o cualquier superficie.
- Lleva piezas rotas como recordatorio de errores evitables.
- Colecciona mapas de corrientes en miniatura.`,
    arc: `# Arco narrativo

Naerys empieza creyendo que solo la excelencia impecable puede protegerla del sistema. Su arco la lleva a entender que ninguna reforma profunda se sostiene sola: necesitara confiar, formar red y aceptar que el liderazgo colectivo es mas poderoso que el heroismo funcional.`,
  },
  {
    username: 'writer_luna',
    worldSlug: 'aetherya',
    name: 'Caelan Vale',
    slug: 'caelan-vale',
    alias: ['El Cartografo de Corrientes'],
    role: CharacterRole.ALLY,
    status: CharacterStatus.ALIVE,
    age: '24',
    avatarUrl: 'https://api.dicebear.com/9.x/shapes/svg?seed=caelan-vale',
    tags: ['hermano', 'cartografo', 'aetherya', 'aliado'],
    appearance: `# Apariencia

Caelan tiene una presencia menos frontal que la de Naerys, pero mas dificil de olvidar. Es alto, delgado y siempre parece estar un poco inclinado hacia la siguiente pregunta. Viste capas ligeras con bolsillos internos para plumas, cristales y medidores de flujo.

## Rasgos clave

- Ojos claros cansados por noches de observacion.
- Voz baja, casi docente.
- Marcas de tinta azul en muñecas y nudillos.
- Lleva colgando un sextante adaptado como amuleto.`,
    personality: `# Personalidad

Caelan observa antes de actuar y procesa antes de responder. Es menos incendiario que su hermana, pero no menos terco. Su especialidad es tender puentes entre visionarios, tecnicos y personas comunes sin que ninguna parte sienta que la estan usando.

## En breve

- Reservado
- Leal
- Agudamente perceptivo
- Mas valiente de lo que aparenta`,
    motivations: `# Motivaciones

Caelan quiere convertir el conocimiento atmosferico en un bien comun. Para el, mapear el cielo no es romantico: es una forma de impedir monopolios y accidentes. Su lucha no busca protagonismo, sino infraestructura justa.

## Lo que persigue

- Publicar atlas abiertos de corrientes.
- Proteger a Naerys sin anular su autonomia.
- Crear una escuela tecnica fuera del control noble.`,
    fears: `# Temores

- Que sus mapas terminen militarizados.
- Ver a su hermana destruirse intentando salvar a todos.
- Descubrir que su prudencia es, en el fondo, cobardia.

## Subtexto

Le preocupa que la historia premie el ruido y no la consistencia, y que eso vuelva invisible el trabajo paciente que sostiene a los demas.`,
    strengths: `# Fortalezas

| Campo | Valor |
| --- | --- |
| Cartografia aerea | Muy alto |
| Observacion | Muy alto |
| Mediacion | Alto |
| Planeacion | Alto |`,
    weaknesses: `# Debilidades

- Duda demasiado antes de confrontar.
- Evita imponer su criterio incluso cuando deberia.
- Su prudencia puede convertirse en demora.
- Tiende a ocultar su desgaste para no preocupar a otros.`,
    backstory: `# Ficha enciclopedica extensa

## Identidad

| Campo | Valor |
| --- | --- |
| Nombre original | Caelan Vale |
| Alias | El Cartografo de Corrientes |
| Titulo | Atlas vivo del Anillo Sur |
| Debut | Registros del Cielo Bajo |
| Estado | Activo |

## Descripcion general

Caelan Vale es un cartografo tecnico de Aetherya especializado en patrones de flujo, rutas de emergencia y deriva climatica. Aunque suele moverse fuera del foco politico, su trabajo sostiene muchas de las operaciones que luego otros capitalizan publicamente.

## Biografia

### Antes de la historia

Paso años ayudando a su familia a mantener plataformas funcionales mientras observaba, en secreto, variaciones de viento que nadie se molestaba en registrar porque afectaban solo a los barrios inferiores.

### Arco inicial

Cuando Naerys comenzo a ganar visibilidad, Caelan eligio acompañarla desde la infraestructura y no desde el discurso. Ese rol le dio informacion privilegiada, pero tambien una tendencia a esconderse detras de su utilidad.

### Punto de quiebre

Un sabotaje a una ruta civil le demuestra que la neutralidad tecnica ya no es posible: sus mapas importan demasiado como para fingir que no son politicos.

### Situacion actual

Se encuentra construyendo un atlas abierto que podria cambiar el equilibrio entre el Cielo Alto y el Cielo Bajo si logra terminarlo a tiempo.`,
    arc: `# Arco

Caelan parte como apoyo silencioso. Su evolucion consiste en asumir voz propia y aceptar que la precision tambien puede ser una forma de liderazgo visible.`,
  },
];

const RELATIONSHIP_GROUP_IDS = {
  isoldeTarek: 'a410f574-fdb3-4d16-afd4-81032b9524f1',
  naerysCaelan: '3dfc6d32-bd7f-42d6-ad50-6bbd5b5dfd42',
} as const;

export async function seed24CharacterMarkdownTemplates(prisma: PrismaClient): Promise<void> {
  await runSeedStep(prisma, 'character markdown templates', async () => {
    const users = await prisma.user.findMany({
      where: { username: { in: [...new Set(CHARACTER_SEEDS.map((entry) => entry.username))] } },
      select: { id: true, username: true },
    });

    const worlds = await prisma.world.findMany({
      where: { slug: { in: [...new Set(CHARACTER_SEEDS.map((entry) => entry.worldSlug))] } },
      select: { id: true, slug: true },
    });

    const userByUsername = new Map(users.map((user) => [user.username, user.id]));
    const worldBySlug = new Map(worlds.map((world) => [world.slug, world.id]));

    const characterIds = new Map<string, string>();

    for (const entry of CHARACTER_SEEDS) {
      const authorId = userByUsername.get(entry.username);
      const worldId = worldBySlug.get(entry.worldSlug);

      if (!authorId || !worldId) {
        console.log(`    Skipping character ${entry.slug}: missing author or world`);
        continue;
      }

      const character = await prisma.character.upsert({
        where: {
          authorId_slug: {
            authorId,
            slug: entry.slug,
          },
        },
        update: {
          worldId,
          name: entry.name,
          alias: entry.alias,
          role: entry.role,
          status: entry.status,
          age: entry.age,
          avatarUrl: entry.avatarUrl ?? null,
          tags: entry.tags,
          appearance: entry.appearance,
          personality: entry.personality,
          motivations: entry.motivations,
          fears: entry.fears,
          strengths: entry.strengths,
          weaknesses: entry.weaknesses,
          backstory: entry.backstory,
          arc: entry.arc,
          isPublic: true,
        },
        create: {
          authorId,
          worldId,
          name: entry.name,
          slug: entry.slug,
          alias: entry.alias,
          role: entry.role,
          status: entry.status,
          age: entry.age,
          avatarUrl: entry.avatarUrl ?? null,
          tags: entry.tags,
          appearance: entry.appearance,
          personality: entry.personality,
          motivations: entry.motivations,
          fears: entry.fears,
          strengths: entry.strengths,
          weaknesses: entry.weaknesses,
          backstory: entry.backstory,
          arc: entry.arc,
          isPublic: true,
        },
      });

      characterIds.set(entry.slug, character.id);
    }

    await upsertKinshipPair(
      prisma,
      characterIds.get('isolde-veyra'),
      characterIds.get('tarek-veyra'),
      {
        forwardType: 'Madre',
        inverseType: 'Hijo',
        forwardKinship: CharacterKinshipType.PARENT,
        inverseKinship: CharacterKinshipType.CHILD,
        description: 'Linaje central del Faro de Ceniza y custodios del borde occidental.',
        groupId: RELATIONSHIP_GROUP_IDS.isoldeTarek,
      },
    );

    await upsertKinshipPair(
      prisma,
      characterIds.get('naerys-vale'),
      characterIds.get('caelan-vale'),
      {
        forwardType: 'Hermana',
        inverseType: 'Hermano',
        forwardKinship: CharacterKinshipType.SIBLING,
        inverseKinship: CharacterKinshipType.SIBLING,
        description: 'Hermanos del Cielo Bajo, unidos por ingenieria, cartografia y reforma social.',
        groupId: RELATIONSHIP_GROUP_IDS.naerysCaelan,
      },
    );
  });
}

async function upsertKinshipPair(
  prisma: PrismaClient,
  sourceId: string | undefined,
  targetId: string | undefined,
  payload: {
    forwardType: string;
    inverseType: string;
    forwardKinship: CharacterKinshipType;
    inverseKinship: CharacterKinshipType;
    description: string;
    groupId: string;
  },
) {
  if (!sourceId || !targetId) {
    return;
  }

  await prisma.characterRelationship.upsert({
    where: {
      sourceId_targetId_type: {
        sourceId,
        targetId,
        type: payload.forwardType,
      },
    },
    update: {
      category: CharacterRelationshipCategory.KINSHIP,
      kinshipType: payload.forwardKinship,
      relationshipGroupId: payload.groupId,
      description: payload.description,
      isMutual: payload.forwardKinship === payload.inverseKinship,
    },
    create: {
      sourceId,
      targetId,
      type: payload.forwardType,
      category: CharacterRelationshipCategory.KINSHIP,
      kinshipType: payload.forwardKinship,
      relationshipGroupId: payload.groupId,
      description: payload.description,
      isMutual: payload.forwardKinship === payload.inverseKinship,
    },
  });

  await prisma.characterRelationship.upsert({
    where: {
      sourceId_targetId_type: {
        sourceId: targetId,
        targetId: sourceId,
        type: payload.inverseType,
      },
    },
    update: {
      category: CharacterRelationshipCategory.KINSHIP,
      kinshipType: payload.inverseKinship,
      relationshipGroupId: payload.groupId,
      description: payload.description,
      isMutual: payload.forwardKinship === payload.inverseKinship,
    },
    create: {
      sourceId: targetId,
      targetId: sourceId,
      type: payload.inverseType,
      category: CharacterRelationshipCategory.KINSHIP,
      kinshipType: payload.inverseKinship,
      relationshipGroupId: payload.groupId,
      description: payload.description,
      isMutual: payload.forwardKinship === payload.inverseKinship,
    },
  });
}
