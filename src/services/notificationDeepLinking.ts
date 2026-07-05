export interface DeepLinkParams {
  route: string;
  params?: Record<string, unknown>;
  root?: boolean;
}

/**
 * Extract deep link parameters from notification data.
 */
export const extractDeepLinkParams = (data: Record<string, unknown>): DeepLinkParams | null => {
  const rawType = typeof data.type === 'string' ? data.type : '';
  const type = rawType.toLowerCase().replace(/[-\s]/g, '_');

  if (type === 'medication') {
    return {
      route: 'Care',
      params: {
        initialTab: 'Medications',
        ...(data.medicationId ? { medicationId: data.medicationId } : {}),
        ...(data.petId ? { petId: data.petId } : {}),
      },
    };
  }

  if (type === 'appointment') {
    return {
      route: 'Schedule',
      params: {
        ...(data.appointmentId ? { appointmentId: data.appointmentId } : {}),
        ...(data.petId ? { petId: data.petId } : {}),
      },
    };
  }

  if (type === 'vaccination' || type === 'vaccination_due') {
    const params: Record<string, unknown> = { initialTab: 'Vaccinations' };
    if (data.vaccinationId) params.vaccinationId = data.vaccinationId;
    if (data.petId) params.petId = data.petId;
    if (data.dueDate) params.dueDate = data.dueDate;

    return {
      route: 'Care',
      params,
    };
  }

  if (type === 'sos' || type === 'sos_alert' || type === 'emergency') {
    return {
      route: 'More',
      params: {
        screen: 'Emergency',
        params: {
          ...(data.sosId ? { sosId: data.sosId } : {}),
          ...(data.petId ? { petId: data.petId } : {}),
        },
      },
    };
  }

  if (type === 'health' || type === 'health_alert' || type === 'alert') {
    return {
      route: 'Care',
      params: {
        initialTab: 'Alerts',
        ...(data.alertId ? { alertId: data.alertId } : {}),
        ...(data.healthAlertId ? { healthAlertId: data.healthAlertId } : {}),
        ...(data.petId ? { petId: data.petId } : {}),
      },
    };
  }

  if (type === 'community_reply' || type === 'community' || type === 'forum_reply') {
    return {
      route: 'Forum',
      params: {
        ...(data.postId ? { postId: data.postId } : {}),
        ...(data.replyId ? { replyId: data.replyId } : {}),
        ...(data.commentId ? { commentId: data.commentId } : {}),
      },
      root: true,
    };
  }

  if ((type === 'birthday' || type === 'pet_birthday') && data.petId) {
    return {
      route: 'PetList',
      params: {
        screen: 'PetDetail',
        params: { petId: data.petId },
      },
    };
  }

  if (data.petId) {
    return {
      route: 'PetList',
      params: {
        screen: 'PetDetail',
        params: { petId: data.petId },
      },
    };
  }

  return null;
};
