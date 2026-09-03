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
  // Type scale straight from the design canvas: 44px/1.0 at -0.04em, with the
  // body copy 12px under it at 15px/1.6 and capped at 64ch.
  return (
    <div data-testid="page-header-container" id="page-header-container">
      <h1 className="text-[44px] font-bold leading-none tracking-[-0.04em] text-ink">{title}</h1>
      {description && (
        <p className="mt-3 max-w-[64ch] text-[15px] leading-[1.6] text-soft">
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
