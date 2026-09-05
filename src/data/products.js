const createFlow = (
  id,
  platform,
  title,
  price,
  category,
  description,
  features,
  options = {},
) => ({
  id,
  type: 'flow',
  platform,
  title,
  price,
  stock: 999,
  details: {
    category,
    flowType: category.toLowerCase(),
    description,
    features,
    delivery: 'Configured for your operating setup',
    purchaseType: 'Reusable automation flow',
    usageNote: 'Run it as many times as your operation needs',
    supportedPlatforms: options.supportedPlatforms || [],
    // Ordered walkthrough of what the automation actually executes.
    howItWorks: options.howItWorks || [],
    // What the buyer needs to already have before running this flow.
    requirements: options.requirements || [],
    // Add a real MP4/WebM URL only when a demo exists. Cards and modals
    // collapse this region entirely when it is omitted.
    demoVideo: options.demoVideo || null,
    demoPoster: options.demoPoster || null,
  },
});

const CREATION_REQUIREMENTS = [
  'An active GeeLark cloud phone profile — this flow runs inside GeeLark, it does not include a GeeLark subscription.',
  'Your own proxy assigned to that profile. Proxy and device-fingerprint quality are the two biggest factors in how the account performs afterward.',
  'A phone number or email inbox you control for the platform\'s verification step.',
];

const EXISTING_ACCOUNT_REQUIREMENT = 'An existing account already logged into a GeeLark profile — this flow does not create the account for you.';

export const products = [
  createFlow(
    'instagram-account-creation',
    'instagram',
    'Instagram Account Creation',
    1000,
    'Account creation',
    'A complete Instagram account-creation workflow built for repeatable mobile operations.',
    ['Signup orchestration', 'Email, SMS & CAPTCHA handling', 'Recovery setup', 'Profile baseline'],
    {
      howItWorks: [
        'Launches Instagram inside your GeeLark cloud phone profile, using that profile\'s own device fingerprint.',
        'Enters the signup details you supply (name, birthdate, and the email or phone number you provide).',
        'Completes the email confirmation link or SMS/phone OTP step automatically, and solves any CAPTCHA challenge Instagram presents.',
        'Sets a baseline display name and username so the account isn\'t left blank, and records the login and recovery details in the run report.',
      ],
      requirements: CREATION_REQUIREMENTS,
    },
  ),
  createFlow(
    'instagram-warmup',
    'instagram',
    'Instagram Warmup',
    250,
    'Warmup',
    'Gradually introduces realistic account activity with configurable pacing and daily routines.',
    ['Progressive activity', 'Session pacing', 'Content browsing', 'Configurable schedules'],
    {
      howItWorks: [
        'Logs into the target account in its existing GeeLark profile.',
        'Runs paced Explore, Reels, and Stories browsing sessions on the schedule you configure — not a single burst of instant activity.',
        'Increases session length and action frequency gradually across the schedule instead of repeating the same pattern every day.',
        'Logs each session\'s screen time, actions taken, and any errors to a run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'A day-count and pacing target — tell us the schedule and the flow is configured to match it.'],
    },
  ),
  createFlow(
    'instagram-profile-edits',
    'instagram',
    'Instagram Profile Editing',
    150,
    'Profile management',
    'Updates every key Instagram profile field in one reusable workflow.',
    ['Profile picture', 'Bio and link', 'Name', 'Username'],
    {
      howItWorks: [
        'Logs into the target account in its GeeLark profile.',
        'Uploads the profile picture you supply and updates the bio text and link field.',
        'Updates the display name and username, checking username availability before committing the change.',
        'Confirms each field saved correctly before ending the run.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The profile picture file, bio copy, and name/username values you want applied.'],
    },
  ),
  createFlow(
    'instagram-publishing',
    'instagram',
    'Instagram Content Publishing',
    150,
    'Publishing',
    'Publishes the major Instagram content formats across one or many managed accounts.',
    ['Reels', 'Single photo posts', 'Gallery posts', 'Stories'],
    {
      howItWorks: [
        'Logs into the target account in its GeeLark profile and loads the media you supply.',
        'Publishes to the format you select — Reel, single photo, multi-photo gallery, or Story — with your caption and any tags applied.',
        'Waits for the platform to confirm the post is live before moving to the next item, instead of firing posts blind.',
        'Reports the published post links back to you in the run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The media files and captions you want published, prepared ahead of the run.'],
    },
  ),

  createFlow(
    'tiktok-account-creation',
    'tiktok',
    'TikTok Account Creation',
    1000,
    'Account creation',
    'A structured TikTok signup workflow designed for consistent mobile execution.',
    ['Signup orchestration', 'Email, SMS & CAPTCHA handling', 'Recovery setup', 'Profile baseline'],
    {
      howItWorks: [
        'Launches TikTok inside your GeeLark cloud phone profile, using that profile\'s own device fingerprint.',
        'Enters the signup details you supply (birthdate, and the email or phone number you provide).',
        'Completes the email confirmation link or SMS/phone OTP step automatically, and solves any CAPTCHA challenge TikTok presents.',
        'Sets a baseline display name and username, and records the login and recovery details in the run report.',
      ],
      requirements: CREATION_REQUIREMENTS,
    },
  ),
  createFlow(
    'tiktok-warmup',
    'tiktok',
    'TikTok Warmup',
    250,
    'Warmup',
    'Builds a configurable viewing and engagement routine for new TikTok accounts.',
    ['Feed browsing', 'Progressive activity', 'Session pacing', 'Configurable schedules'],
    {
      howItWorks: [
        'Logs into the target account in its existing GeeLark profile.',
        'Scrolls the For You feed with variable watch-time per video, occasional likes, and paced follows on the schedule you configure.',
        'Increases session length and action frequency gradually across the schedule instead of repeating the same pattern every day.',
        'Logs each session\'s screen time, actions taken, and any errors to a run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'A day-count and pacing target — tell us the schedule and the flow is configured to match it.'],
    },
  ),
  createFlow(
    'tiktok-profile-edits',
    'tiktok',
    'TikTok Profile Editing',
    150,
    'Profile management',
    'Automates TikTok profile setup and repeatable profile changes.',
    ['Profile picture', 'Bio and link', 'Name', 'Username'],
    {
      howItWorks: [
        'Logs into the target account in its GeeLark profile.',
        'Uploads the profile picture you supply and updates the bio text and link field.',
        'Updates the display name and username, checking username availability before committing the change.',
        'Confirms each field saved correctly before ending the run.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The profile picture file, bio copy, and name/username values you want applied.'],
    },
  ),
  createFlow(
    'tiktok-publishing',
    'tiktok',
    'TikTok Content Publishing',
    150,
    'Publishing',
    'Handles TikTok publishing workflows across supported post formats.',
    ['Video posts', 'Photo carousels', 'Stories', 'Caption input'],
    {
      howItWorks: [
        'Logs into the target account in its GeeLark profile and loads the media you supply.',
        'Publishes to the format you select — video, photo carousel, or Story — with your caption, sound choice, and any tags applied.',
        'Waits for TikTok to confirm the post is live before moving to the next item, instead of firing posts blind.',
        'Reports the published post links back to you in the run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The media files and captions you want published, prepared ahead of the run.'],
    },
  ),

  createFlow(
    'snapchat-account-creation',
    'snapchat',
    'Snapchat Account Creation',
    800,
    'Account creation',
    'A mobile-first Snapchat account-creation workflow with guided configuration points.',
    ['Signup orchestration', 'Email, SMS & CAPTCHA handling', 'Recovery setup', 'Profile baseline'],
    {
      howItWorks: [
        'Launches Snapchat inside your GeeLark cloud phone profile, using that profile\'s own device fingerprint.',
        'Enters the signup details you supply (name, birthdate, and the phone number or email you provide).',
        'Completes the phone/SMS OTP step or email confirmation automatically, and solves any CAPTCHA challenge Snapchat presents.',
        'Sets a baseline display name and username, and records the login and recovery details in the run report.',
      ],
      requirements: CREATION_REQUIREMENTS,
    },
  ),
  createFlow(
    'snapchat-warmup',
    'snapchat',
    'Snapchat Warmup',
    250,
    'Warmup',
    'Runs a paced Snapchat activity routine for newly created accounts.',
    ['Discover browsing', 'Session pacing', 'Progressive activity', 'Daily schedules'],
    {
      howItWorks: [
        'Logs into the target account in its existing GeeLark profile.',
        'Browses Discover content and Snap Map with variable dwell time on the schedule you configure.',
        'Increases session length and action frequency gradually across the schedule instead of repeating the same pattern every day.',
        'Logs each session\'s screen time, actions taken, and any errors to a run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'A day-count and pacing target — tell us the schedule and the flow is configured to match it.'],
    },
  ),
  createFlow(
    'snapchat-adds',
    'snapchat',
    'Snapchat Adds',
    150,
    'Growth operations',
    'Processes add actions from a configured source with controllable pacing.',
    ['Source list input', 'Paced actions', 'Duplicate checks', 'Run reporting'],
    {
      howItWorks: [
        'Reads the username list or Snapcode source you supply for this run.',
        'Sends add requests one at a time at the pace you configure, instead of in a single burst.',
        'Skips entries already added or already pending, so the same contact isn\'t processed twice across runs.',
        'Reports how many adds succeeded, were skipped, or failed in the run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The list of usernames or Snapcodes you want processed, and your target daily add limit.'],
    },
  ),

  createFlow(
    'reddit-account-creation',
    'reddit',
    'Reddit Account Creation',
    1000,
    'Account creation',
    'A reusable Reddit signup workflow for structured account operations.',
    ['Signup orchestration', 'Email, SMS & CAPTCHA handling', 'Recovery setup', 'Profile baseline'],
    {
      howItWorks: [
        'Launches Reddit inside your GeeLark cloud phone profile, using that profile\'s own device fingerprint.',
        'Enters the signup details you supply (username preference and the email or phone number you provide).',
        'Completes the email confirmation link or phone OTP step automatically, and solves any CAPTCHA challenge Reddit presents.',
        'Sets a baseline username and avatar, and records the login and recovery details in the run report.',
      ],
      requirements: CREATION_REQUIREMENTS,
    },
  ),
  createFlow(
    'reddit-warmup',
    'reddit',
    'Reddit Warmup',
    250,
    'Warmup',
    'Creates a measured Reddit browsing and participation routine.',
    ['Subreddit browsing', 'Session pacing', 'Progressive activity', 'Daily schedules'],
    {
      howItWorks: [
        'Logs into the target account in its existing GeeLark profile.',
        'Browses the subreddits you specify, with variable dwell time and occasional upvotes, on the schedule you configure.',
        'Increases session length and action frequency gradually across the schedule instead of repeating the same pattern every day.',
        'Logs each session\'s screen time, actions taken, and any errors to a run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The subreddit list and a day-count/pacing target for the schedule.'],
    },
  ),
  createFlow(
    'reddit-posting',
    'reddit',
    'Reddit Posting',
    200,
    'Publishing',
    'Publishes prepared content to configured communities with repeatable inputs.',
    ['Text posts', 'Media posts', 'Community selection', 'Run reporting'],
    {
      howItWorks: [
        'Logs into the target account in its GeeLark profile and loads the title, body, or media you supply.',
        'Publishes to the subreddit you select as a text or media post, respecting that community\'s post-type rules where configured.',
        'Waits for Reddit to confirm the post is live before moving to the next item, instead of firing posts blind.',
        'Reports the published post links back to you in the run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The post titles, body text or media, and target subreddits you want used.'],
    },
  ),

  createFlow(
    'facebook-account-creation',
    'facebook',
    'Facebook Account Creation',
    1000,
    'Account creation',
    'A structured Facebook signup workflow prepared for mobile account operations.',
    ['Signup orchestration', 'Email, SMS & CAPTCHA handling', 'Recovery setup', 'Profile baseline'],
    {
      howItWorks: [
        'Launches Facebook inside your GeeLark cloud phone profile, using that profile\'s own device fingerprint.',
        'Enters the signup details you supply (name, birthdate, and the email or phone number you provide).',
        'Completes the email confirmation link or SMS/phone OTP step automatically, and solves any CAPTCHA challenge Facebook presents.',
        'Sets a baseline display name and profile photo, and records the login and recovery details in the run report.',
      ],
      requirements: CREATION_REQUIREMENTS,
    },
  ),
  createFlow(
    'facebook-warmup',
    'facebook',
    'Facebook Warmup',
    250,
    'Warmup',
    'Runs a configurable Facebook activity schedule for new accounts.',
    ['Feed browsing', 'Session pacing', 'Progressive activity', 'Daily schedules'],
    {
      howItWorks: [
        'Logs into the target account in its existing GeeLark profile.',
        'Browses the News Feed and, where configured, joined Groups with variable dwell time on the schedule you set.',
        'Increases session length and action frequency gradually across the schedule instead of repeating the same pattern every day.',
        'Logs each session\'s screen time, actions taken, and any errors to a run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'A day-count and pacing target — tell us the schedule and the flow is configured to match it.'],
    },
  ),
  createFlow(
    'facebook-publishing',
    'facebook',
    'Facebook Content Publishing',
    150,
    'Publishing',
    'Automates Facebook publishing across the primary content formats.',
    ['Stories', 'Feed posts', 'Reels', 'Caption input'],
    {
      howItWorks: [
        'Logs into the target account in its GeeLark profile and loads the media you supply.',
        'Publishes to the format you select — feed post, Story, or Reel — with your caption and any tags applied.',
        'Waits for Facebook to confirm the post is live before moving to the next item, instead of firing posts blind.',
        'Reports the published post links back to you in the run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The media files and captions you want published, prepared ahead of the run.'],
    },
  ),

  createFlow(
    'youtube-channel-creation',
    'youtube',
    'YouTube Channel Creation',
    250,
    'Channel creation',
    'Creates and configures a YouTube channel through a repeatable setup workflow.',
    ['Channel creation', 'Basic identity setup', 'Configuration steps', 'Completion checks'],
    {
      howItWorks: [
        'Launches YouTube inside your GeeLark cloud phone profile, signed into the Google account you provide.',
        'Creates a new channel under that account and sets the channel name you supply.',
        'Applies a baseline channel icon and description, and confirms the channel is visible and active.',
        'Records the channel URL and any configuration details in the run report.',
      ],
      requirements: ['An existing Google account already logged into a GeeLark profile — this flow creates the channel, not the Google account.', 'The channel name, icon, and description you want applied.'],
    },
  ),
  createFlow(
    'youtube-warmup',
    'youtube',
    'YouTube Warmup',
    250,
    'Warmup',
    'Builds a configurable viewing routine for new YouTube profiles and channels.',
    ['Video browsing', 'Session pacing', 'Progressive activity', 'Daily schedules'],
    {
      howItWorks: [
        'Logs into the target channel in its existing GeeLark profile.',
        'Watches videos in the niche or search terms you specify, with variable watch-time per video, on the schedule you configure.',
        'Increases session length and action frequency gradually across the schedule instead of repeating the same pattern every day.',
        'Logs each session\'s screen time, videos watched, and any errors to a run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The niche, search terms, or channel list to watch from, and a pacing target for the schedule.'],
    },
  ),
  createFlow(
    'youtube-publishing',
    'youtube',
    'YouTube Publishing',
    150,
    'Publishing',
    'Uploads prepared long-form and short-form video content with reusable inputs.',
    ['YouTube Shorts', 'Long-form videos', 'Titles and descriptions', 'Upload checks'],
    {
      howItWorks: [
        'Logs into the target channel in its GeeLark profile and loads the video file you supply.',
        'Uploads it as a Short or long-form video, applying the title, description, and tags you provide.',
        'Waits for YouTube to finish processing and confirm the upload is live before reporting completion.',
        'Reports the published video link back to you in the run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The video files, titles, and descriptions you want published, prepared ahead of the run.'],
    },
  ),

  createFlow(
    'threads-account-creation',
    'threads',
    'Threads Account Creation via Instagram',
    100,
    'Account creation',
    'Creates a Threads presence from a configured Instagram account.',
    ['Instagram handoff', 'Threads activation', 'Basic profile setup', 'Completion checks'],
    {
      howItWorks: [
        'Logs into the existing Instagram account in its GeeLark profile and opens the Threads activation flow from within Instagram.',
        'Carries over the Instagram profile name, photo, and bio into the new Threads profile.',
        'Confirms the Threads account is active and reachable, and applies any profile adjustments you request.',
        'Records the Threads handle and activation status in the run report.',
      ],
      requirements: ['An existing Instagram account already logged into a GeeLark profile — Threads is activated from that account, it is not created standalone.'],
    },
  ),
  createFlow(
    'threads-warmup',
    'threads',
    'Threads Warmup',
    250,
    'Warmup',
    'Runs a paced browsing and interaction routine for a Threads account.',
    ['Feed browsing', 'Session pacing', 'Progressive activity', 'Daily schedules'],
    {
      howItWorks: [
        'Logs into the target account in its existing GeeLark profile.',
        'Browses the Threads feed with variable dwell time and occasional likes/replies on the schedule you configure.',
        'Increases session length and action frequency gradually across the schedule instead of repeating the same pattern every day.',
        'Logs each session\'s screen time, actions taken, and any errors to a run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'A day-count and pacing target — tell us the schedule and the flow is configured to match it.'],
    },
  ),
  createFlow(
    'threads-posting',
    'threads',
    'Threads Posting',
    100,
    'Publishing',
    'Publishes prepared Threads content using configurable text and media inputs.',
    ['Text posts', 'Media attachments', 'Caption input', 'Run reporting'],
    {
      howItWorks: [
        'Logs into the target account in its GeeLark profile and loads the text or media you supply.',
        'Publishes the post, attaching any images or links you provide.',
        'Waits for Threads to confirm the post is live before moving to the next item, instead of firing posts blind.',
        'Reports the published post links back to you in the run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The post text and media you want published, prepared ahead of the run.'],
    },
  ),

  createFlow(
    'dating-warmup',
    'dating',
    'Dating App Warmup',
    300,
    'Warmup',
    'A platform-specific warmup workflow for one supported dating app.',
    ['App-specific routines', 'Session pacing', 'Progressive activity', 'Configurable schedules'],
    {
      supportedPlatforms: ['Tinder', 'Wink', 'Bumble', 'Badoo', 'Grindr'],
      howItWorks: [
        'Logs into the target profile on your chosen app, inside its existing GeeLark profile.',
        'Runs paced browsing and swiping activity native to that app, on the schedule you configure — not a single burst of instant activity.',
        'Increases session length and action frequency gradually across the schedule instead of repeating the same pattern every day.',
        'Logs each session\'s screen time, actions taken, and any errors to a run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'Which of the five supported apps you need — the flow is configured per app, not generically.'],
    },
  ),
  createFlow(
    'dating-chat-automation',
    'dating',
    'Dating App Chat Automation',
    400,
    'Messaging',
    'A configurable chat workflow developed for one supported dating platform.',
    ['Conversation inputs', 'Reply workflow', 'Paced messaging', 'Run reporting'],
    {
      supportedPlatforms: ['Tinder', 'Wink', 'Bumble', 'Badoo', 'Grindr'],
      howItWorks: [
        'Logs into the target profile on your chosen app, inside its existing GeeLark profile.',
        'Reads open conversations and matches the message library and reply logic you provide.',
        'Sends replies at the pace you configure, rather than instantly, and flags conversations that don\'t match your reply logic for manual handling.',
        'Reports which conversations were messaged, skipped, or flagged in the run report.',
      ],
      requirements: [EXISTING_ACCOUNT_REQUIREMENT, 'The message library and reply logic you want the flow to use, and which of the five supported apps you need.'],
    },
  ),
];

export const platforms = [
  { id: 'instagram', label: 'Instagram', shortLabel: 'IG', color: '#f43f8f' },
  { id: 'tiktok', label: 'TikTok', shortLabel: 'TT', color: '#18d8d0' },
  { id: 'snapchat', label: 'Snapchat', shortLabel: 'SC', color: '#facc15' },
  { id: 'reddit', label: 'Reddit', shortLabel: 'RD', color: '#f97316' },
  { id: 'facebook', label: 'Facebook', shortLabel: 'FB', color: '#3b82f6' },
  { id: 'youtube', label: 'YouTube', shortLabel: 'YT', color: '#ef4444' },
  { id: 'threads', label: 'Threads', shortLabel: 'TH', color: '#a78bfa' },
  { id: 'dating', label: 'Dating apps', shortLabel: 'DA', color: '#fb7185' },
];

export const specialties = [
  {
    title: 'Video spoofing',
    description: 'Platform-specific video input and camera-source workflows for controlled mobile environments.',
    marker: 'VS',
  },
  {
    title: 'Metadata transformation',
    description: 'Prepare, adjust, and validate media metadata before it enters a publishing workflow.',
    marker: 'MD',
  },
  {
    title: 'Video generation',
    description: 'Connect content generation, formatting, and delivery into a repeatable production pipeline.',
    marker: 'VG',
  },
  {
    title: 'Analytics & tracking',
    description: 'Collect run status, account-level outcomes, and operational metrics in one reporting layer.',
    marker: 'AT',
  },
  {
    title: 'Account operations at scale',
    description: 'Coordinate large account sets with controlled schedules, inputs, and centralized monitoring.',
    marker: 'OS',
  },
  {
    title: 'Mobile SEO searches',
    description: 'Automate mobile search journeys, keyword paths, result interactions, and reporting.',
    marker: 'MS',
  },
];

export const categories = [
  { id: 'all', label: 'All flows' },
  { id: 'flows', label: 'Automation flows' },
];
