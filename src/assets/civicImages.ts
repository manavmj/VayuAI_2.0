import heroCanopyImg from './images/hero_canopy_sunlight_1794640282489.jpg';
import wardMonitoringImg from './images/civic_ward_monitoring_1794640282835.jpg';
import housingSocietyImg from './images/housing_society_greenery_1794640283246.jpg';
import schoolCleanAirImg from './images/school_clean_air_1794640284649.jpg';
import type { UserRole } from '../types/vayu.ts';

export const HERO_CANOPY_IMAGE = heroCanopyImg;

export const ROLE_CIVIC_IMAGES: Record<UserRole, { src: string; alt: string }> = {
  ward_officer: {
    src: wardMonitoringImg,
    alt: 'Solar-powered municipal roadside air quality monitoring station along a tree-lined Indian avenue',
  },
  housing_society: {
    src: housingSocietyImg,
    alt: 'Green residential housing society courtyard with shaded pathways and water misting dust suppression',
  },
  school: {
    src: schoolCleanAirImg,
    alt: 'Sunlit school campus courtyard surrounded by trees with students entering a ventilated building',
  },
};
