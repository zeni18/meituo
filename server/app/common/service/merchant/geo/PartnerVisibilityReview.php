<?php
declare(strict_types=1);
namespace app\common\service\merchant\geo;

/** Accepted provider task needs reconciliation, not a new paid submission. */
final class PartnerVisibilityReview extends \RuntimeException {}
