let cleanerOnboardingComplete = false;

export const setCleanerOnboardingOverride = (value: boolean) => {
  cleanerOnboardingComplete = value;
};

export const getCleanerOnboardingOverride = () => cleanerOnboardingComplete;
