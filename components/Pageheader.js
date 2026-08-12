// PageHeader.js
import React from "react";
import { ExternalLinkIcon } from "./Icons";
import SmartLink from "./SmartLink";

/**
 * Reusable page header component
 * @param {string} title - The page title
 * @param {string} description - The page description
 * @param {string} docLink - The link to the documentation page
 * @returns {JSX.Element}
 */
const PageHeader = ({ title, description, docLink }) => {
  return (
    <div data-testid="page-header-container" id="page-header-container" className="mb-6">
      <h1 className="text-[32px] font-extrabold tracking-[-0.04em] leading-none mb-2">{title}</h1>
      {description && (
        <p className="max-w-[78ch] text-[15px] leading-[1.55] text-soft">
          {description}
          <SmartLink data-testid="page-header-learn-more-link" id="page-header-learn-more-link" href={docLink}>
            <span className="inline-flex ml-1 items-center gap-1.5 text-[15px] font-semibold text-acc hover:opacity-80 transition-opacity group">
              Learn more <ExternalLinkIcon size={15} />
            </span>
          </SmartLink>
        </p>
      )}
    </div>
  );
};

export default PageHeader;
