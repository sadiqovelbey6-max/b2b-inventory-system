/**
 * Azerbaycan dilində tarix və saat formatlaması üçün utility funksiyaları
 */

const azMonths = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'İyun',
  'İyul',
  'Avqust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];

const azWeekdays = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];

/**
 * Tarixi Azerbaycan formatında formatlayır
 * @param date - Formatlanacaq tarix (string, Date və ya number)
 * @param includeTime - Saatı daxil etmək istəyirsinizmi? (default: false)
 * @returns Formatlanmış tarix string-i
 */
export const formatDate = (date: string | Date | number, includeTime = false): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Tarix məlumatı yoxdur';
  }

  const day = dateObj.getDate();
  const month = azMonths[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  if (includeTime) {
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  }

  return `${day} ${month} ${year}`;
};

/**
 * Tam tarix və saatı formatlayır
 * @param date - Formatlanacaq tarix
 * @returns Formatlanmış tarix və saat string-i
 */
export const formatDateTime = (date: string | Date | number): string => {
  return formatDate(date, true);
};

/**
 * Yalnız saatı formatlayır
 * @param date - Formatlanacaq tarix
 * @returns Formatlanmış saat string-i (HH:MM)
 */
export const formatTime = (date: string | Date | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Saat məlumatı yoxdur';
  }

  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Nisbi zaman formatlaması (bugün, dünən, 2 gün əvvəl və s.)
 * @param date - Formatlanacaq tarix
 * @returns Nisbi zaman string-i
 */
export const formatRelativeTime = (date: string | Date | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Tarix məlumatı yoxdur';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  // Bugün
  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMinutes === 0) {
        return 'İndi';
      }
      return `${diffMinutes} dəqiqə əvvəl`;
    }
    return `Bugün, ${formatTime(dateObj)}`;
  }

  // Dünən
  if (diffDays === 1) {
    return `Dünən, ${formatTime(dateObj)}`;
  }

  // Bu həftə
  if (diffDays < 7) {
    return `${diffDays} gün əvvəl, ${formatTime(dateObj)}`;
  }

  // Bu ay
  if (dateObj.getMonth() === now.getMonth() && dateObj.getFullYear() === now.getFullYear()) {
    return `${dateObj.getDate()} ${azMonths[dateObj.getMonth()]}, ${formatTime(dateObj)}`;
  }

  // Bu il
  if (dateObj.getFullYear() === now.getFullYear()) {
    return `${dateObj.getDate()} ${azMonths[dateObj.getMonth()]}, ${formatTime(dateObj)}`;
  }

  // Tam tarix
  return formatDateTime(dateObj);
};

/**
 * Ay adını qaytarır
 * @param monthIndex - Ay indeksi (0-11)
 * @returns Ay adı
 */
export const getMonthName = (monthIndex: number): string => {
  if (monthIndex < 0 || monthIndex > 11) {
    return 'Naməlum ay';
  }
  return azMonths[monthIndex];
};

/**
 * Həftə günü adını qaytarır
 * @param date - Tarix
 * @returns Həftə günü adı
 */
export const getWeekdayName = (date: string | Date | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Naməlum gün';
  }

  return azWeekdays[dateObj.getDay()];
};

/**
 * Tarixi qısa formatda formatlayır (DD.MM.YYYY)
 * @param date - Formatlanacaq tarix
 * @returns Qısa format tarix string-i
 */
export const formatDateShort = (date: string | Date | number): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Tarix məlumatı yoxdur';
  }

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}.${month}.${year}`;
};

/**
 * Tarixi uzun formatda formatlayır (Həftə günü, DD AY YYYY)
 * @param date - Formatlanacaq tarix
 * @param includeTime - Saatı daxil etmək istəyirsinizmi?
 * @returns Uzun format tarix string-i
 */
export const formatDateLong = (date: string | Date | number, includeTime = false): string => {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Tarix məlumatı yoxdur';
  }

  const weekday = getWeekdayName(dateObj);
  const day = dateObj.getDate();
  const month = azMonths[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  if (includeTime) {
    const time = formatTime(dateObj);
    return `${weekday}, ${day} ${month} ${year}, ${time}`;
  }

  return `${weekday}, ${day} ${month} ${year}`;
};

