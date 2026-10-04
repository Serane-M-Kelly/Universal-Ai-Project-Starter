// Estimation de durée : 4 km/h et 300 m de dénivelé positif par heure.
export const duree = (km, deniv) => `${Math.round((km / 4 + deniv / 300) * 10) / 10} h`;
