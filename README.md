# DocuTool 📄✨

DocuTool is a powerful, browser-based utility designed to streamline the process of scanning documents and creating printable ID card sheets. Built with Next.js and TypeScript, it offers a clean, responsive, and feature-rich interface for all your document handling needs, right in your web browser.

-----

## Key Features

DocuTool is packed with features to make document processing simple and efficient.

  * ✨ **Smart Document Scanner**:

      * Upload images directly from your device.
      * Paste images from your clipboard for quick scanning.
      * Intelligent **perspective crop** tool to precisely select document corners, correcting any distortion.

  * 🎨 **Image Editor**:

      * **One-click filters**: Apply presets like "Magic", "Grayscale", or "Black & White" to enhance readability.
      * **Rotate** your cropped documents with a single click.
      * Easily **re-crop** if the initial selection wasn't perfect.

  * 🖼️ **Gallery**:

      * All your saved scans are neatly organized in a dedicated gallery.
      * Quickly **view, re-edit, or delete** any saved document.

  * 💳 **ID Card Document Creator**:

      * Select one (front side only) or two (front and back) images from your gallery.
      * Automatically arranges them on a **printable A4 sheet**.
      * Adjust the final **card width** (in cm) to match standard sizes.

  * 🚀 **Export & Print**:

      * Download the final A4 document as a high-quality **PNG** or a professional **PDF**.
      * Directly **print** the document from the browser.

  * 🌗 **Modern UI/UX**:

      * **Light & Dark Mode**: Switch themes for your comfort.
      * **Fully Responsive**: Works seamlessly on desktop and mobile devices.
      * **Toast Notifications**: Get instant feedback for your actions.
      * **Smooth Animations**: Built with Framer Motion for a fluid user experience.

-----

## Tech Stack

This project is built using a modern, robust technology stack:

  * **Framework**: [Next.js](https://nextjs.org/) (with React)
  * **Language**: [TypeScript](https://www.typescriptlang.org/)
  * **Styling**: [Tailwind CSS](https://tailwindcss.com/) (via CSS Variables for theming)
  * **Icons**: [Lucide React](https://lucide.dev/)
  * **Animations**: [Framer Motion](https://www.framer.com/motion/)
  * **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF) (loaded dynamically)
  * **State Management**: React Context API

-----

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) (version 18.x or later) and npm installed on your machine.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/docutool.git
    ```
2.  **Navigate to the project directory:**
    ```bash
    cd docutool
    ```
3.  **Install NPM packages:**
    ```bash
    npm install
    ```
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) with your browser to see the result.

-----

## How to Use

1.  **Scan an Image**: Navigate to the **Image Scanner** page. Upload a file or paste an image from your clipboard.
2.  **Crop the Document**: You'll be taken to the cropping screen. Drag the four corner handles to perfectly align with the document's edges and click **Apply Crop**.
3.  **Edit and Save**: On the editing screen, apply filters or rotate the image as needed. Click **Save** to add it to your gallery.
4.  **Create ID Card Document**: Go to the **ID Card Maker** page. Click **Select Images**, choose up to two scans from your gallery, and click **Create Document**.
5.  **Download or Print**: In the preview screen, set your desired card width and file name. Then, download the document as a PNG/PDF or print it directly.

-----

## Code Overview

The entire application is encapsulated within a single, well-structured file (`App.tsx`), demonstrating a cohesive component-based architecture.

  * **Type Definitions**: All necessary TypeScript types and interfaces are defined at the top for clarity.
  * **App Provider & Context (`AppContext`)**: A global state manager for theme, toasts, pages, and cropped images.
  * **Styling & Layout Components**: `GlobalStyles`, `Card`, and `PageWrapper` provide consistent styling and structure.
  * **Perspective Transform Helpers**: The `perspectiveTransform` and `gaussianElimination` functions contain the core mathematical logic for the smart crop feature.
  * **Main Logic (`ToolPages`)**: This is the central component that handles the application's state (`cropping`, `editing`, `idle`) and renders the appropriate UI for each page (`scanner`, `gallery`, `id_card_maker`).
  * **Core App Component (`App`)**: The root component that sets up the context provider, routing (via URL hash), and overall layout.
  * **UI Components**: Reusable components like `Sidebar`, `Header`, `Modal`, and `Toast` are defined to build the application's interface.

-----

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
